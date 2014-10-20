'use strict';

var pushPresenceApp = angular.module('pushPresenceApp',  ['ui.bootstrap','checklist-model']);

pushPresenceApp.controller('OptionsCtrl', ['$scope','$window',
  function ($scope, $window) {

    $scope.StorageTypes = $window.StorageTypes;
    $scope.EventTypes = $window.EventTypes;

    $scope.model = new DataModel();

    var loadApiKey = function(){
      PushBullet.APIKey = $scope.model.pushBulletApiToken;
      console.log('api key set');
    };

    var getDevices = function(){
      console.log('Populating devices');
      PushBullet.devices(function(err, res){
        if(err){
          console.log(err);
          return;
        }

        console.log(res.devices);
        $scope.model.devices = _.chain(res.devices)
        .where({active:true}).map(function(data){
          return _.pick(data,['iden','nickname']);
        }).value();

        $scope.$apply();
      });
    };

    chrome.storage.sync.get($scope.model, function(items){
      console.log('Binding model from storage');
      $scope.model = items;
      loadApiKey();

      $scope.$apply();
    });

    $scope.SetToken = function(){
      loadApiKey();

      if(PushBullet.APIKey.length == 32){
        getDevices();
      } else if (PushBullet.APIKey == ''){
        console.log('Resetting model');
        $scope.model = new DataModel();
      }
    }

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

    $scope.Clear = function(){
      chrome.storage.sync.clear(function(){
        $scope.saveStatus = 'Cleared';
        console.log('Cleared');
        $scope.model = new DataModel();
        $scope.$apply();
      });
    };

    $scope.RefreshDevices= function(){
      getDevices();
    };

    $scope.AddSubscription = function(storageTypeIndex){

      var storageType = $scope.StorageTypes[storageTypeIndex];
      var sub = new Subscription(storageType);
      sub.deviceId = $scope.model.deviceId;
      switch(storageType){
        case 'local':
        $scope.model.localSubscriptions.push(sub);
        break;
        case 'sync':
        $scope.model.cloudSubscriptions.push(sub);
        break;
        default:
        break;
      }
    };
  }]);

pushPresenceApp.directive('isodatestring', function() {
  return {
    //hack to handle chrome storage not persisting date objects
    //https://stackoverflow.com/a/12947995
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attr, ngModel) {
      ngModel.$parsers.push(function(date){
        return new Date(date).toISOString();
      });
    }
  };
});

pushPresenceApp.directive('appSubscription',  function() {
  return {
    restrict: 'E',
    scope:{
      model: "=data"
    },
    link: function($scope, element, attrs) {
     $scope.AddTimeframe = function(a) {
      $scope.model.timeframes.push(new Timeframe());
    }
  },
  templateUrl: '../templates/subscription.html'
};
});

pushPresenceApp.filter('capitalize', function() {
  return function(input, all) {
    //uses prototype method found in datamodel.js
    return (!!input) ? input.capitalize() : '';
  }
});
