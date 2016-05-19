app.factory("openFileService", [function () {

    // Grab hold of the hidden file input control from the view
    var openFileInput = document.getElementById("openFileInput");

    var openFileService = {
        _callback : null, // Initiallly null, to be assigned when show is called
        show : function(callback) {
            // Reset the value so the change handler can be triggered even if the user
            // selects the same file as last time
            openFileInput.value = "";
            this._callback = callback;            
            openFileInput.click();
        }        
    };
    
    // Register the event handler on the input control for checking when the user has selected the file
    openFileInput.addEventListener("change", function () {
        if (openFileInput.value !== null && openFileInput.value !== "") {        
            if (openFileService._callback !== undefined && openFileService._callback !== null && openFileInput.files.length > 0) {                
                // Proceed to read the file selected. Since the readAsText function is async,
                // an event handler is used to process the read result
                var selectedFile = openFileInput.files[0];
                if (selectedFile !== null) {
                    var reader = new FileReader();
                    reader.readAsText(selectedFile);
                    reader.onloadend = function() {                
                        openFileService._callback(reader.result);
                    };
                }
            }
        }
    });
    
    return openFileService;    
}]);
