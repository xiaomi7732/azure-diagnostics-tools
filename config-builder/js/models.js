function createModelSpace(jsonPrototypeString, xmlPrototypeString, fieldCustomMappings) {
    
    //----------------------------------------------------------------------------------------------
    // constructObject
    // Look up the constructor from the constructor map and create the object. Creating
    // the object this way ensures the prototype is set properly
    //----------------------------------------------------------------------------------------------
    function constructObject(modelDef, constructorKeyPath) {
        // Call the right constructor to create the object.
        // Also do a first clone to get a copy of all prototype methods and properties
        var result = new modelDef.constructorMap[constructorKeyPath]();        
        cloneModelObject(modelDef, result, result);
        
        return result;
    }
    
    //----------------------------------------------------------------------------------------------
    // generateModelClasses
    // This function generates model constructor functions based on the read in sample model
    //----------------------------------------------------------------------------------------------
    function generateModelClasses(modelDef, keyPath, obj) {

        var children = [];
        
        // Make sure the key is at least an empty string 
        var shortName = keyPath;
        if (!shortName) {
            // For the root, the keyPath is the empty string. Use __root for the constructor
            // function name 
            shortName = "__root";
        } else {
            var pathArray = keyPath.split("/");
            shortName = pathArray[pathArray.length - 1];
        }

        // Generate the two statements for creating the class. At the same time, collect the list of child
        // objects so we can generate model classes for them too
        var statement1 = "func = modelDef.constructorMap[\"" + keyPath + "\"] = function " + shortName + "() {}";        
        var statement2 = "func.keyPath = \"" + keyPath + "\";";
        var statement3 = "modelDef.constructorMap[\"" + keyPath + "\"].prototype = {"
        for (var prop in obj) {
            statement3 += prop + " : ";
            switch (typeof obj[prop]) {
                case "string" :
                    statement3 += "\"" + obj[prop] + "\"";
                    break;
                case "number" :
                case "boolean" :
                    statement3 += obj[prop].toString();
                    break;                    
                case "object" :
                    var childObject;
                    if (obj[prop] instanceof Array) {
                        statement3 += "[]";
                        childObject = obj[prop][0];
                    } else {
                        statement3 += "null";
                        childObject = obj[prop];
                    }
                    children.push({
                        name : prop,
                        obj : childObject
                    })
                    break;
            }
            statement3 += ",";
        }
        statement3 += "constructor : modelDef.constructorMap[\"" + keyPath + "\"]};";
        
        eval(statement1);
        eval(statement2);
        eval(statement3);
        
        // Go through all children we collected earlier and generate model classes for them
        for (var i = 0; i < children.length; i++) {
            generateModelClasses(modelDef, keyPath + "/" + children[i].name, children[i].obj);
        }
    }

    //----------------------------------------------------------------------------------------------
    // generateXmlTemplateModel
    // This function generators an XML template model that can be cloned, modified, and returned as
    // output
    //----------------------------------------------------------------------------------------------
    function generateXmlTemplateModel(modelDef, prototypeString) {
        var xmlParser = new DOMParser();
        modelDef.xmlTemplate = xmlParser.parseFromString(prototypeString, "application/xml");
    }

    //----------------------------------------------------------------------------------------------
    // determineType
    // Determines the type of an object. This method can only be called for model objects backed by
    // the proper prototype object.
    //----------------------------------------------------------------------------------------------
    function determineType(obj) {
        var type = typeof obj;
        if (type === "object" && obj instanceof Array) {
            type = "array";
        }
        
        return type;
    }
    
    //----------------------------------------------------------------------------------------------
    // determinePropertyType
    // Determines the type of the property of a given name for the object. This method can only be
    // called for model objects backed by the proper prototype object.
    //----------------------------------------------------------------------------------------------
    function determinePropertyType(obj, propName) {
        var prop = obj[propName];
        if (prop === undefined) {
            throw "Internal error: obj doesn't have property '" + propName + "'";
        }

        // If the prop value is null, then we can't really deduce the type from it. Look up the value from
        // the prototype and determine the type from it
        if (prop === null) {
            var prototypeProp = Object.getPrototypeOf(obj)[propName];
            
            // This should never happen, but checking just in case
            if (prototypeProp === undefined) {
                throw "Object has property '" + propName + "' which doesn't exist in its prototype"; 
            }                    
            prop = prototypeProp;
        }
        
        return determineType(prop);
    }

    //----------------------------------------------------------------------------------------------
    // isIgnorableMetaProperty
    // Determines if the given property is a meta property that we should ignore. It simply checks
    // it against a known set of name patterns.
    //----------------------------------------------------------------------------------------------
    function isIgnorableMetaProperty(propName) {
        // All properties beginning with '$' are angular meta properties, which are also meta
        // properties that should be ignored
        return propName === "constructor" || propName.indexOf("$") === 0;
    }

    //----------------------------------------------------------------------------------------------
    // cloneModelArray
    //----------------------------------------------------------------------------------------------
    function cloneModelArray(modelDef, sourceArray, targetArray, parentPath) {
        
        // TODO: Figure out what the target array element type, so we can type check later on
        // TOOD: Array of primitive types, like string and numbers, are untested and not supported
        // right now. Will need to add support for it
        for (var i = 0; i < sourceArray.length; i++) {
            
            var element = sourceArray[i];
            var newElement;

            switch (typeof element) {
                case "string" :
                case "number" :
                case "boolean" :
                    targetArray.push(element);
                    break;
                    
                case "object" :
                    if (element instanceof Array) {
                        // Arrays within arrays are not supported
                        throw "Arrays of arrays are not supported"
                    }
                    newElement = constructObject(modelDef, parentPath);
                    cloneModelObject(modelDef, element, newElement);
                    targetArray.push(newElement);
                    break;
            }
        }
    }
    
    //----------------------------------------------------------------------------------------------
    // cloneModelObject
    //----------------------------------------------------------------------------------------------
    function cloneModelObject(modelDef, source, target) {
        for (var propName in source) {
            
            // Skip the constructor property, this is just a meta property on the prototype that
            // should never be copied
            if (isIgnorableMetaProperty(propName)) {
                continue;
            }
            
            var sourceProp = source[propName];
            
            // Check to see if target also have this property. If so, then clone it
            if (target[propName] === undefined) {
                throw "Source has property '" + propName + "' which is not supported by the config prototype"; 
            }

            var newElement;
            
            // If the source property value is null, simply set it on the target property value
            // without type checking because if target is a simple type like a number, the type
            // check would valid, but assigning null to it should be allowed
            if (sourceProp === null) {
                newElement = null;    
            } else {
                var sourceType = typeof sourceProp;
                var targetType = determinePropertyType(target, propName);
                
                if (typeof targetType !== typeof sourceType) {
                    throw "Source's property '" + propName + "' has type not matching target's property type"; 
                }

                // Figure out the current target object path through the prototype and constructor
                var currentPath = Object.getPrototypeOf(target).constructor.keyPath;

                switch (targetType) {
                    case "string" :
                    case "number" :
                    case "boolean" :
                        // For these simple cases, just a straight copy is good
                        newElement = sourceProp;
                        break;
                    case "array" :
                        // For array, need to clean up the target's array and clone all objects from source
                        newElement = []                    
                        cloneModelArray(modelDef, sourceProp, newElement, currentPath + "/" + propName);
                        break;
                    case "object" :
                        // Use the prop name to find the constructor defined in the model definition, then
                        // invoke to create the new object
                        newElement = constructObject(modelDef, currentPath + "/" + propName);
                        cloneModelObject(modelDef, sourceProp, newElement);
                        break;
                }
            }
            
            target[propName] = newElement;
        }
    }

    //----------------------------------------------------------------------------------------------
    // loadFromXmlConfig
    // If the user has supplied an XML config, this function helps convert it to the javascript
    // object tree, which uses the JSON model space, that the rest of the program works with
    //----------------------------------------------------------------------------------------------
    function loadFromXmlConfig(modelDef, source, target) {
        
        var sourceProps = [];
        
        // Accumulate a list of children from the attributes and child nodes
        if (source.attributes) {
            for (var i = 0; i < source.attributes.length; i++) {
                var attribute = source.attributes[i];
                
                // Just skip a bunch of attributes that we don't process
                if (attribute.name === "xmlns") {
                    continue;
                }
                sourceProps.push({
                    name : attribute.name,
                    value : attribute.value
                });
            }                        
        }
        if (source.firstElementChild) {
            var child = source.firstElementChild;
            while (child) {
                sourceProps.push({
                    name : child.nodeName,
                    value : child.textContent,
                    element : child
                });
                child = child.nextElementSibling;
            }
        }
        
        // Figure out the current target object path through the prototype and constructor
        var currentPath = Object.getPrototypeOf(target).constructor.keyPath;
        
        // Loop through all source properties
        for (var i = 0; i < sourceProps.length; i++) {
            var sourceProp = sourceProps[i];
            var propName = sourceProp.name;
        
            // Check to see if target also have this property. If so, then clone it
            if (target[propName] === undefined) {
                throw "Source has property '" + propName + "' which is not supported"; 
            }

            var newElement = null;
            var targetType = determinePropertyType(target, propName);
                
            switch (targetType) {
                case "string" :
                case "number" :
                case "boolean" :
                    if (targetType === "string") {
                        newElement = sourceProp.value;
                    } else {
                        newElement = JSON.parse(sourceProp.value);
                    }

                    // Check the new element type created by parse to make sure it matches
                    if (typeof newElement !== targetType) {
                        throw "Source's property '" + propName + "' has type not matching target's property type"; 
                    }
                    target[propName] = newElement;
                    break;
                case "array" : 
                case "object" :
                    if (sourceProp.element === undefined) {
                        // If objNode is undefined, then this is an xml attribute, which means the source doesn't have
                        // an object here. It's an error in this case
                        throw "Source's property '" + propName + "' has type not matching target's property type";
                    }

                    // Use the prop name to find the constructor defined in the model definition, then
                    // invoke to create the new object
                    newElement = constructObject(modelDef, currentPath + "/" + propName);
                    loadFromXmlConfig(modelDef, sourceProp.element, newElement);
                    
                    if (targetType === "array") {
                        if (target[propName] === null) {
                            target[propName] = [];
                        }
                        target[propName].push(newElement);
                    } else {
                        target[propName] = newElement;            
                    }
                    
                    break;
                default:
                    break;
            }            
        }
    }

    //----------------------------------------------------------------------------------------------
    // serializeToJson
    // Recursive function to serialize the object tree into a human readable, with good
    // indentation format, JSON string         
    //----------------------------------------------------------------------------------------------
    function serializeToJson(obj, objName, indent) {
        
        var result = indent;
        var indentIncrement = "    ";        
        
        // If this is the root object, or an object inside the array, then skip adding the name and colon, otherwise
        // it should always have the name
        if (objName && objName.length > 0) {
            result += "\"" + objName + "\": ";
        }
                                        
        // Determine how to serialize the content of the object
        switch (typeof obj) {
            case "string" :
                // Use JSON.stringify to make sure the string is JSON escaped properly
                result += JSON.stringify(obj);
                break;
            case "number" :
            case "boolean" :
                result += obj.toString();
                break;                        
            case "object" :
                if (obj === null) {
                    // We should theoretically never hit this because the caller should have check
                    // for null already and not recurse into this call. However, if it does happen, we
                    // would handle it safely and print null
                    result += "null";
                } else if (obj instanceof Array) {
                    // For array, need to loop through each element in the array and serialize
                    result += "[";
                    for (var i = 0; i < obj.length; i++) {                        
                        // At this point, it's not possible for obj[i] to be null because if so, it would
                        // have been removed from the array. So there is no check for obj[i] being null                        
                        if (i > 0) {
                            result += ",";
                        }
                        result += "\n";
                        result += serializeToJson(obj[i], "", indent + indentIncrement);
                    }                    
                    result += "\n" + indent + "]";
                } else {
                    // For object, need to loop through each property and serialize
                    result += "{";
                    var i = 0;
                    for (var propName in obj) {
                        // Skip the constructor property, or angular metaproperties (starts with '$'), or any
                        // property with a null value
                        if (isIgnorableMetaProperty(propName) || obj[propName] === null) {
                            continue;
                        }
                        if (i > 0) {
                            result += ",";
                        }                                
                        result += "\n";
                        result += serializeToJson(obj[propName], propName, indent + indentIncrement);
                        i++
                    }                    
                    result += "\n" + indent + "}";
                }
                break;            
        }
        
        return result;
    }

    //----------------------------------------------------------------------------------------------
    // serializeToXml
    // Recursive function to serialize the object tree into a human readable, with good
    // indentation format, XML string. This function should not assume the obj tree was built with
    // prototype objects         
    //----------------------------------------------------------------------------------------------
    function serializeToXml(obj, xmlTemplateNode, indent) {
        
        if (obj === null) {
            // We should theoretically never hit this because the caller should have check
            // for null already and not recurse into this call. However, if it does happen, we
            // would handle it safely and return an empty string
            return "";
        }        
        
        var result = "";
        var indentIncrement = "    ";
                                        
        // Determine how to serialize the content of the object
        switch (typeof obj) {
            case "string" :
            case "number" :
            case "boolean" :
                // For simple values, simply close off the start tag and add the value and closing tag
                result += indent + "<" + xmlTemplateNode.nodeName + ">" + obj.toString() + "</" + xmlTemplateNode.nodeName + ">"; 
                break;
            case "object" :
                if (obj instanceof Array) {
                    // For array, need to loop through each element in the array and serialize
                    for (var i = 0; i < obj.length; i++) {                        
                        // At this point, it's not possible for obj[i] to be null because if so, it would
                        // have been removed from the array. So there is no check for obj[i] being null
                        if (result.length > 0) {
                            result += "\n";
                        }
                        result += serializeToXml(obj[i], xmlTemplateNode, indent);
                    }                    
                } else {
                    var elementStartLine = indent + "<" + xmlTemplateNode.nodeName;
                    var childLines = "";

                    // For object, need to loop through each property and serialize
                    for (var propName in obj) {
                        // Skip the constructor property, or angular metaproperties (starts with '$'), or any
                        // property with a null value
                        if (isIgnorableMetaProperty(propName) || obj[propName] === null) {
                            continue;
                        }
                        // Check to see if this child should be an attribute or a child node
                        var templateAttr = xmlTemplateNode.attributes.getNamedItem(propName);
                        if (templateAttr != null) {
                            // This should be an attribute, append the attribute inline into the current element tag
                            elementStartLine += " " + propName + "=\"" + obj[propName].toString() + "\"";
                        } else {
                            // Check to make sure this is a child node
                            var templateChild = null;
                            var currentChild = xmlTemplateNode.firstElementChild;
                            while (currentChild) {
                                if (currentChild.nodeName === propName) {
                                    templateChild = currentChild;
                                    break;
                                }
                                currentChild = currentChild.nextElementSibling;
                            }                            
                            if (templateChild === null) {
                                throw "Unable to generate XML: could not find node '" + propName + "' in the XML template";
                            }

                            var childLine = serializeToXml(obj[propName], templateChild, indent + indentIncrement);
                            
                            // Sometimes the serialization of a child may come back empty, such as when the child object is an empty
                            // array. In this case, we don't want to add linefeed unless we are sure we got some non-empty
                            // result from serializing the child object                            
                            if (childLine.length > 0) {
                                childLines += "\n" + childLine;
                            } 
                        }
                    }
                    if (childLines.length > 0) {
                        // This logic adds linefeed and indent so the closing tag can be indented nicely. If no children, then
                        // childLines remain empty string so the closing tag can be on the same line as the starting tag
                        result += elementStartLine + ">" + childLines + "\n" + indent + "</" + xmlTemplateNode.nodeName + ">";
                    } else {
                        // Omit the closing tag by just ending the start tag, if there were no children
                        result += elementStartLine + " />";
                    }
                }
                break;            
        }
        
        // Return the result, including the closing tag for the current element 
        return result;
    }
    
    //----------------------------------------------------------------------------------------------
    // jsonToXmlPreconvert
    // Preconverts the given JSON object tree, which follows the JSON schema, into another JSON
    // object tree. The converted object tree is still a JSON object tree, but follows the XML schema.
    // The currentSourcePath represents the path for the current sourceRoot object relative to the
    // absolute root, the currentTargetPath represents the path for the current targetRoot object relative
    // to the absolute root.
    // The result is then ready for serialization to XML.
    //----------------------------------------------------------------------------------------------
    function jsonToXmlPreconvert(sourceRoot, currentSourcePath, targetRoot, currentTargetPath, fieldMappings) {

        if (sourceRoot === null || currentSourcePath === null || targetRoot === null || currentTargetPath === null || fieldMappings === null) {
            // We should theoretically never hit this because the caller should have check
            // for null already and not recurse into this call. However, if it does happen, we
            // would handle it safely and return an empty string
            return;
        }

        var sourceType = determineType(sourceRoot);
        switch (sourceType) {
            case "string" :
            case "number" :
            case "boolean" :
            case "array" :
                // Find the mapping in the mappings
                var mapping = null;
                for (var i = 0; i < fieldMappings.length; i++) {
                    if (fieldMappings[i].json === currentSourcePath) {
                        mapping = fieldMappings[i];
                        break;
                    }
                }

                // For simple type field, there must be a mapping for it. If there isn't mapping for it,
                // then it's an error
                if (mapping === null) {
                    // Throw an error if a mapping is not found for this field
                    throw "Mapping not found for the JSON field:'" + currentSourcePath + "', the field name in JSON may have been mistyped";
                }
                
                // Make sure the target root is a parent path of the mapped path. If it's not, then it's an error
                var xmlPath = mapping.xml;
                if (xmlPath.indexOf(currentTargetPath) !== 0 || xmlPath[currentTargetPath.length] !== '/') {
                    throw "Mapping for JSON field:'" + currentSourcePath + "' is invalid because it's inconsistent with other mappings";
                }
                
                var targetPropName = xmlPath.slice(xmlPath.lastIndexOf("/") + 1);
                var xmlRelativePath = xmlPath.slice(currentTargetPath.length);
                
                // Use the path to find the target object in the XML to set the field
                var target = targetRoot;
                var pathArray = xmlRelativePath.split("/");
                for (var i = 0; i < pathArray.length - 1; i++) {
                    
                    // Since all paths start with a "/", the split function most likely gives an empty string as the
                    // first element, which would represent the root. Since we always start at the root, we should
                    // skip it if the first element is empty
                    if (i === 0 && pathArray[i] === "") {
                        continue;
                    } 
                    
                    var next = target[pathArray[i]];
                    if (next === undefined || next === null) {
                        next = {};
                        target[pathArray[i]] = next;                    
                    }
                    target = next;
                }
                 
                // Set the field with the proper mapped field name
                if (sourceType !== "array") {
                    target[targetPropName] = sourceRoot;
                } else {
                    // For array, things are more tricky because there can be 1 or more objects inside. In the normal case,
                    // we can always traverse through the target object tree using the target path to rediscover the target
                    // object to set the field, as shown above for the simple type field case. However, when an array is
                    // in the middle, it fans out to multiple possible target objects. The target path no longer identifies
                    // a unique target object. To make this work, we need to rebase the target root with the "current" object
                    // so all fields below that maps to the "current working" target object
                    // Find the mapping in the mappings
                    if (target[targetPropName] === undefined || target[targetPropName] === null) {
                        target[targetPropName] = [];
                    }
                    
                    for (var i = 0; i < sourceRoot.length; i++) {
                        var newItem = {};
                        jsonToXmlPreconvert(sourceRoot[i], currentSourcePath, newItem, xmlPath, fieldMappings);
                        target[targetPropName].push(newItem);
                    }
                }
                break;
                                
            case "object" :
                for (var propName in sourceRoot) {
                    // Skip the constructor property, this is just a meta property on the prototype that
                    // should never be copied
                    if (isIgnorableMetaProperty(propName)) {
                        continue;
                    }        

                    jsonToXmlPreconvert(sourceRoot[propName], currentSourcePath + "/" + propName, targetRoot, currentTargetPath, fieldMappings);
                }
                break;
        }
    }

    //----------------------------------------------------------------------------------------------
    // xmlToJsonPreconvert
    // Preconverts the given XML object tree, which follows the XML schema, into another JSON
    // object tree. The converted object tree is still a JSON object tree, but may not be a fully
    // functioning JSON object tree with all prototypes set correctly. The goal is to convert it
    // so the result looks as if it's read from a JSON file that matches the JSON schema.
    // The result is then ready for hydrating into our in-memory JSON object model
    //----------------------------------------------------------------------------------------------
    function xmlToJsonPreconvert(modelDef, sourceRoot, currentSourcePath, targetRoot, currentTargetPath) {

        if (modelDef === null || sourceRoot === null || currentSourcePath === null ||
            targetRoot === null || currentTargetPath === null || modelDef.fieldCustomMappings === null) {
            // We should theoretically never hit this because the caller should have check
            // for null already and not recurse into this call. However, if it does happen, we
            // would handle it safely and return an empty string
            return;
        }

        var sourceRootIsAttribute = Object.getPrototypeOf(sourceRoot).constructor.name === "Attr";        

        // Determine the mapping first
        var fieldMappings = modelDef.fieldCustomMappings;
            
        // Find the mapping in the mappings
        var mapping = null;
        for (var i = 0; i < fieldMappings.length; i++) {
            if (fieldMappings[i].xml === currentSourcePath) {
                mapping = fieldMappings[i];
                break;
            }
        }
        
        var propType = null;
        
        // These fields are rebased target information to be used for processing children nodes. In the
        // case of an array, we will set a new root for the target root
        var rebasedTargetRoot = targetRoot;
        var rebasedTargetPath = currentTargetPath;

        // We can't tell what the field type is right now. XML nodes can always be a node, or it can have children. If
        // we can find a mapping, we just have to assume it's a leaf node with a simple type value, or an array and recurse into
        // all its children. If we can't find a mapping, then we assume it's not a leaf node.
        if (mapping !== null) {                
            // Make sure the target root is a parent path of the mapped path. If it's not, then it's an error
            var jsonPath = mapping.json;
            if (jsonPath.indexOf(currentTargetPath) !== 0 || jsonPath[currentTargetPath.length] !== '/') {
                throw "Mapping for XML field:'" + currentSourcePath + "' is invalid because it's inconsistent with other mappings";
            }
            
            var targetPropName = jsonPath.slice(jsonPath.lastIndexOf("/") + 1);
            var jsonRelativePath = jsonPath.slice(currentTargetPath.length);
            
            // Use the path to find the target object in the XML to set the field
            var target = targetRoot;
            var pathArray = jsonRelativePath.split("/");
            for (var i = 0; i < pathArray.length - 1; i++) {
                
                // Since all paths start with a "/", the split function most likely gives an empty string as the
                // first element, which would represent the root. Since we always start at the root, we should
                // skip it if the first element is empty
                if (i === 0 && pathArray[i] === "") {
                    continue;
                } 
                
                var next = target[pathArray[i]];
                if (next === undefined || next === null) {
                    next = {};
                    target[pathArray[i]] = next;                    
                }
                target = next;
            }
            
            // We still don't know whether this is a simple type field or an array. Determine the type using
            // using target's prototype
            var parentTargetPath = jsonPath.slice(0, jsonPath.lastIndexOf("/"));
            var parentConstructor = modelDef.constructorMap[parentTargetPath];
            
            if (!parentConstructor) {
                throw "Internal error: Unable to find schema for object of JSON path: '" + parentTargetPath + "'";
            }
            
            propType = determinePropertyType(parentConstructor.prototype, targetPropName); 
            switch (propType) {
                case "string" :
                    target[targetPropName] = sourceRoot.textContent;
                    break;
                case "number" :
                case "boolean" :
                    target[targetPropName] = JSON.parse(sourceRoot.textContent);
                    break;
                case "array" :
                    if (sourceRootIsAttribute) {
                        throw "XML field '" + currentSourcePath + "' should not be an attribute because it should map to an array in the JSON tree";
                    }
                    
                    // For array, things are more tricky because there can be 1 or more objects inside. In the normal case,
                    // we can always traverse through the target object tree using the target path to rediscover the target
                    // object to set the field, as shown above for the simple type field case. However, when an array is
                    // in the middle, it fans out to multiple possible target objects. The target path no longer identifies
                    // a unique target object. To make this work, we need to rebase the target root with the "current" object
                    // so all fields below that maps to the "current working" target object
                    // Find the mapping in the mappings
                    if (target[targetPropName] === undefined || target[targetPropName] === null) {
                        target[targetPropName] = [];
                    }
                    
                    rebasedTargetRoot = {};
                    rebasedTargetPath = jsonPath;

                    target[targetPropName].push(rebasedTargetRoot);
                    break;
            }                
        }
        
        if (mapping === null || propType === "array") {
            if (sourceRootIsAttribute) {
                throw "Cannot find a mapping for attribute '" + currentSourcePath + "'";
            }

            // Accumulate a list of children from the attributes and child nodes
            if (sourceRoot.attributes) {
                for (var i = 0; i < sourceRoot.attributes.length; i++) {
                    var attribute = sourceRoot.attributes[i];
                    
                    // Just skip a bunch of attributes that we don't process
                    if (attribute.name === "xmlns") {
                        continue;
                    }
                    
                    xmlToJsonPreconvert(modelDef, attribute, currentSourcePath + "/" + attribute.name, rebasedTargetRoot, rebasedTargetPath, fieldMappings);
                }                        
            }
            if (sourceRoot.firstElementChild) {
                var child = sourceRoot.firstElementChild;
                while (child) {
                    xmlToJsonPreconvert(modelDef, child, currentSourcePath + "/" + child.nodeName, rebasedTargetRoot, rebasedTargetPath, fieldMappings);
                    child = child.nextElementSibling;
                }
            }
        }
    }

    //----------------------------------------------------------------------------------------------
    // Public object with a list of exposed methods/constructors
    //----------------------------------------------------------------------------------------------
    var modelSpace = 
    {
        _modelDef : {
            constructorMap : {
                // To be filled by the generateModelClasses function
            },            
            xmlTemplate : null,
            fieldCustomMappings : null,
        },
        
        initialize : function(jsonPrototypeString, xmlPrototypeString, fieldCustomMappings) {
            var json = JSON.parse(jsonPrototypeString);
            generateModelClasses(this._modelDef, "", json);
            
            // XML template is not always available. Generate the XML template model only if we have one
            if (xmlPrototypeString !== undefined && xmlPrototypeString !== null && xmlPrototypeString !== "") {
                generateXmlTemplateModel(this._modelDef, xmlPrototypeString);
            }
            
            if (fieldCustomMappings !== undefined) {
                this._modelDef.fieldCustomMappings = fieldCustomMappings;
            }
        },
        
        createNewConfig : function () {
            // Does a clone again to make all inherited properties from prototypes, for all objects, to
            // be redefined. Unfortunately this is required because ngRepeat skips properties where hasOwnProperty
            // returns false
            var result = constructObject(this._modelDef, "");
            return result;
        },

        resetConfig : function (configRoot) {
            // Clear the config by copying a blank config to the given root object
            var blankConfig = constructObject(this._modelDef, "");
            cloneModelObject(this._modelDef, blankConfig, configRoot);            
        },

        loadConfig : function(configRoot, content) {
            content = content.trim(); 

            // Make a guess about if the content is json or xml by just looking at the first character
            if (content.length == 0) {
                throw "File is empty or contain only white spaces";
            }
            
            switch (content[0]) {
                case '{':
                    var json = JSON.parse(content);

                    // Create a new object and clone all the data to it
                    cloneModelObject(this._modelDef, json, configRoot);
                    break;
                case '<':
                    var xmlParser = new DOMParser();
                    var xml = xmlParser.parseFromString(content, "application/xml");
                    
                    // Load the xml object tree into the config root.
                    if (this._modelDef.fieldCustomMappings === null) {
                        loadFromXmlConfig(this._modelDef, xml.documentElement, configRoot);
                    } else {
                        // If custom field mappings are defined, then we need to preconvert and then clone
                        var jsonObject = {};
                        xmlToJsonPreconvert(this._modelDef, xml.documentElement, "", jsonObject, "");
                        cloneModelObject(this._modelDef, jsonObject, configRoot);
                    }
                    break;
                default:
                    throw "File is not a valid JSON or XML config file"; 
                    
            }
        },
        
        convertToJsonString : function(configRoot) {
            return serializeToJson(configRoot, "", "");
        },

        convertToXmlString : function(configRoot) {
            
            var jsonObj = configRoot;

            if (this._modelDef.xmlTemplate === null) {
                return "";
            }
                        
            // Sometimes the XML format and the JSON format don't match up nicely. In this case,
            // the model space may define a preconvert method for transforming the object coming from JSON
            // space into one that matches nicely with the XML space. After that, then it can serialize to XML nicely.
            // If such a function exists, call it first
            if (this._modelDef.fieldCustomMappings !== null) {
                newRoot = {};
                jsonToXmlPreconvert(jsonObj, "", newRoot, "", this._modelDef.fieldCustomMappings);
                jsonObj = newRoot;
            }
            
            // Pass in the document element as the root element to kick off the serialization
            return serializeToXml(jsonObj, this._modelDef.xmlTemplate.documentElement, "");
        },
        
        addArrayElement : function(arrayOwnerObject, arrayFieldName) {
            // Figure out the current target object path through the prototype and constructor
            var currentPath = Object.getPrototypeOf(arrayOwnerObject).constructor.keyPath;

            var element = constructObject(this._modelDef, currentPath + "/" + arrayFieldName);
            arrayOwnerObject[arrayFieldName].push(element);
        },

        includeItem : function(ownerObject, fieldName) {
            // Check if there is constructor of this name, then most likely it's a simple field
            // in the object. Look up the default value from the prototype and use it.
            var prototypeValue = ownerObject.constructor.prototype[fieldName];
            if (prototypeValue === undefined) {
                // This should never happen. If it ever does, fail gracefully by simply ignoring
                return ;
            }

            switch (typeof prototypeValue) {
                case "object" :
                    if (prototypeValue instanceof Array) {
                        // Create a new array as a start
                        ownerObject[fieldName] = [];
                    } else {
                        // Figure out the current target object path through the prototype and constructor
                        var currentPath = Object.getPrototypeOf(ownerObject).constructor.keyPath;

                        var constructorFunction = this._modelDef.constructorMap[currentPath + "/" + fieldName];
                        // No constructor of this name, then most likely it's a simple field
                        // in the object. Look up the default value from the prototype and use it.
                        if (constructorFunction === undefined) {
                            // This should never happen. If it ever does, fail gracefully by simply ignoring
                            return ;
                        }
 
                        // There is a constructor for this field. Simply create the object and set it
                        var item = constructObject(this._modelDef, currentPath + "/" + fieldName);
                        ownerObject[fieldName] = item;
                    }
                    break;
                    
                default:
                    // For a simple field in the object. Look up the default value from the prototype and use it.
                    var value = ownerObject.constructor.prototype[fieldName];
                    if (value !== undefined) {
                        ownerObject[fieldName] = value;
                    }
                    break;
            }                
        },

        excludeItem : function(ownerObject, fieldName) {
            if (ownerObject instanceof Array) {
                // For array, excluding an item means removing it from the array
                ownerObject.splice(parseInt(fieldName), 1);            
            } else {
                // For object, excluding an item means just setting a field to null. The field
                // needs to stay there
                ownerObject[fieldName] = null;
            }
        },
        
        hasXmlTemplate : function() {
            return this._modelDef.xmlTemplate !== null; 
        }
    };

    modelSpace.initialize(jsonPrototypeString, xmlPrototypeString, fieldCustomMappings);
    
    return modelSpace;
}
var ConfigModelSpaces = {
    WADCFG : {
        publicSpace : createModelSpace(wadcfgConfigPrototype.jsonPublic, wadcfgConfigPrototype.xmlPublic, undefined),
        privateSpace : createModelSpace(wadcfgConfigPrototype.jsonPrivate, wadcfgConfigPrototype.xmlPrivate, wadcfgConfigPrototype.privateFieldCustomMappings)
    },
    LADCFG : {
        publicSpace : createModelSpace(ladcfgConfigPrototype.jsonPublic, ladcfgConfigPrototype.xmlPublic, undefined),
        privateSpace : createModelSpace(ladcfgConfigPrototype.jsonPrivate, ladcfgConfigPrototype.xmlPrivate, undefined)
    },
}