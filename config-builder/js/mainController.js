app.controller("mainController", ["$scope", "$rootScope", function ($scope, $rootScope) {
    
    // Loop through to discover all config model spaces
    $scope.configModelSpaces = ConfigModelSpaces;
    
    // Publicly exposed members
    $scope.activeCfgBuilder = "WADCFG";
    
    $scope.exportJson = function() {
        $rootScope.$emit("generateJson");
    };

    $scope.exportXml = function() {
        $rootScope.$emit("generateXml");
    };
    
}]);
