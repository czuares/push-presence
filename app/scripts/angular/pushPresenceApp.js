'use strict';

var pushPresenceApp = angular.module('pushPresenceApp',  ['ui.bootstrap']);

pushPresenceApp.controller('OptionsCtrl', ['$scope', '$window',
  function ($scope, $window) {

    $scope.deviceId = null;
    $scope.online = navigator.onLine;
    $scope.EventTypes = $window.EventTypes;
    $scope.DaysOfWeek = $window.DaysOfWeek;

    $scope.model = new DataModel();
    $scope.config = new ConfigurationModel();

    var onlineStateChanged = function(online){
      $scope.$apply(function() {
        console.log((online ? 'on' : 'off' ) + 'line at ' + new Date());
        $scope.online = online;
      });
    }

    var loadApiKey = function(){
      PushBullet.APIKey = $scope.config.pushBulletApiToken;
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
        $scope.config.devices = _.chain(res.devices)
        .where({active:true}).map(function(data){
          return _.pick(data,['iden','nickname']);
        }).value();

        $scope.$apply();
      });
    };

    var resetModel = function(){
      console.log('Resetting model');
      $scope.model = new DataModel();
    };

    var resetConfig = function(){
      chrome.storage.sync.clear(function(){
        console.log('Cleared synced');
        $scope.config = new ConfigurationModel();
        $scope.$apply();
      });
    }

    $window.addEventListener("offline", function () {
      onlineStateChanged(false);
    }, false);
    $window.addEventListener("online", function () {
      onlineStateChanged(true);
    }, false);

    chrome.storage.sync.get($scope.config, function(items){
      console.log('Binding config from synced storage');
      $scope.config = items;
      loadApiKey();

      $scope.$apply();
    });
    chrome.storage.local.get($scope.model, function(items){
      console.log('Binding data model from local storage');
      $scope.model = items;
      $scope.$apply();
    });

    $scope.ApiKeySet = function(){
      return $scope.config.pushBulletApiToken.length == 32;
    };

    $scope.SetToken = function(){
      loadApiKey();

      if(PushBullet.APIKey.length == 32){
        getDevices();
      } else if (PushBullet.APIKey == ''){
        resetConfig();
        resetModel();
      }
    }

    $scope.DeviceSelected = function(){
      console.log('Selected device ' + $scope.deviceId);
    };

    $scope.Save = function(){
      chrome.storage.sync.set($scope.config, function(){
        $scope.saveStatus = 'Saved';
        console.log('Saved config');
        $scope.$apply();
      });
      chrome.storage.local.set($scope.model, function(){
        $scope.saveStatus = 'Saved';
        console.log('Saved data model');
        $scope.$apply();
      });
    };

    $scope.Reset = function(){
      chrome.storage.local.clear(function(){
        $scope.saveStatus = 'Cleared';
        console.log('Reset local');
        resetModel();
        $scope.$apply();
      });
    };

    $scope.RefreshDevices= function(){
      getDevices();
    };

    $scope.AddSubscription = function(){
      var sub = new Subscription();
      sub.deviceId = $scope.deviceId;
      $scope.model.subscriptions.push(sub);
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
    link: function($scope, $parent, element, attrs) {
      $scope.AddTimeframe = function(a) {
        $scope.model.timeframes.push(new Timeframe());
      };

      $scope.RemoveTimeFrame = function(idx) {
        console.log('index: ' + idx);
        $scope.model.timeframes.splice(idx, 1);
      };

      $scope.TestPush = function(){
        var res = PushBullet.push('note',
          $scope.model.deviceId, null, {
            title : 'Test from PushPresence',
            body : 'Test Notification'
          });
        console.log(res);
      };

      $scope.DayName = function(day){
        return $scope.$parent.DaysOfWeek[day.id];
      };
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
