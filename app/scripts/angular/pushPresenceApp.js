'use strict';

var pushPresenceApp = angular.module('pushPresenceApp',  ['ui.bootstrap']);

pushPresenceApp.controller('OptionsCtrl', ['$scope','$window',
function ($scope, $window) {

  $scope.StorageType = $window.StorageType;
  $scope.devices = [];
  $scope.model = new DataModel();

  chrome.storage.sync.get($scope.model, function(items){
    console.log('binding model from storage');
    $scope.model = items;
    $scope.UpdateToken();

    $scope.$apply();
  });

  var getDevices = function(){
    console.log('populating devices');
    PushBullet.devices(function(err, res){
      if(err){
        console.log(err);
        return;
      }

      console.log(res.devices);
      $scope.devices = res.devices;

      $scope.$apply();
    });
  };

  $scope.UpdateToken = function(){
    PushBullet.APIKey = $scope.model.pushBulletApiToken;
    console.log('api key set');

    if(PushBullet.APIKey.length == 32){
      getDevices();
    }
    if (PushBullet.APIKey == ''){
      console.log('clearing devices');
      $scope.model.deviceId = '';
      $scope.devices = [];
    }
  };

  $scope.DeviceSelected = function(){
    console.log('Selected device ' + $scope.model.deviceId);
  };

  $scope.TestPush = function(){
    var res = PushBullet.push('note',
    $scope.model.deviceId, null, {
      title : 'Test from PushPresence',
      body : 'Test Notification'
    });
    console.log(res);
  };

  $scope.Save = function(){
    chrome.storage.sync.set($scope.model, function(){
      $scope.saveStatus = 'Saved';
      console.log('Saved');
      $scope.$apply();
    });
  };

}]);

//hack to handle chrome storage not persisting date objects
//https://stackoverflow.com/a/12947995
pushPresenceApp.directive('isodatestring', function() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attr, ngModel) {
      function fromUser(date) {
        return new Date(date).toISOString();
      }

      ngModel.$parsers.push(fromUser);
    }
  };
});
