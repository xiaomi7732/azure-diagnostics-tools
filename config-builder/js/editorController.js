app.controller("editorController", ["$scope", "$rootScope", "openFileService", function ($scope, $rootScope, openFileService) {
    
    // Publicly exposed members
    $scope.newPublicConfig = function () {
        $scope.modelSpace.publicSpace.resetConfig($scope.model.publicConfig);
    };

    $scope.newPrivateConfig = function () {
        $scope.modelSpace.privateSpace.resetConfig($scope.model.privateConfig);
    };
   
    $scope.loadPublicConfig  = function () {
        // Reset the value so the change handler can be triggered even if the user
        // selects the same file as last time
        openFileService.show(function(fileContent) {
            processFileContent($scope.modelSpace.publicSpace, $scope.model.publicConfig, fileContent);
        });
    };

    $scope.loadPrivateConfig  = function () {
        // Reset the value so the change handler can be triggered even if the user
        // selects the same file as last time
        openFileService.show(function(fileContent) {
            processFileContent($scope.modelSpace.privateSpace, $scope.model.privateConfig, fileContent);
        });
    };
    
    $scope.model = {
        publicConfig : $scope.modelSpace.publicSpace.createNewConfig(),
        privateConfig : $scope.modelSpace.privateSpace.createNewConfig()
    };

    $scope.getType = function(variable) {
        var typeName = typeof variable;
        if (typeName === "object") {
            if (variable instanceof Array) {
                typeName = "array";
            }
        }
        return typeName;
    }
    
    $scope.addArrayElementClick = function(arrayOwnerObject, arrayFieldName, isInPublicConfig) {
        if (isInPublicConfig) {
            $scope.modelSpace.publicSpace.addArrayElement(arrayOwnerObject, arrayFieldName);    
        } else {
            $scope.modelSpace.privateSpace.addArrayElement(arrayOwnerObject, arrayFieldName);    
        }       
    }

    $scope.includeItemClick = function(ownerObject, fieldName, isInPublicConfig) {
        if (isInPublicConfig) {
            $scope.modelSpace.publicSpace.includeItem(ownerObject, fieldName);
        } else {
            $scope.modelSpace.privateSpace.includeItem(ownerObject, fieldName);
        }
    }
    
    $scope.excludeItemClick = function(ownerObject, fieldName, isInPublicConfig) {
        if (isInPublicConfig) {
            $scope.modelSpace.publicSpace.excludeItem(ownerObject, fieldName);
        } else {
            $scope.modelSpace.privateSpace.excludeItem(ownerObject, fieldName);
        }
    }

    // Private implementation
    function processFileContent(modelSpace, configModel, fileContent) {
        
        // Need to apply two update cycles
        // First, clear all the config, which ensures the old HTML with old bindings are completely cleaned out
        // Second, load the new config, this loads new HTML with clean new bindings
        $scope.$apply(function(){
            modelSpace.resetConfig(configModel);
        });
        $scope.$apply(function(){
            modelSpace.loadConfig(configModel, fileContent);
        });
    }
    
    $rootScope.$on("generateJson", function() {
        $scope.model.publicConfigJson  = $scope.modelSpace.publicSpace.convertToJsonString($scope.model.publicConfig);
        $scope.model.privateConfigJson = $scope.modelSpace.privateSpace.convertToJsonString($scope.model.privateConfig);
    });

    $rootScope.$on("generateXml", function() {
        $scope.model.publicConfigXml = $scope.modelSpace.publicSpace.convertToXmlString($scope.model.publicConfig);
        $scope.model.privateConfigXml = $scope.modelSpace.privateSpace.convertToXmlString($scope.model.privateConfig);
    });
    
}]);
