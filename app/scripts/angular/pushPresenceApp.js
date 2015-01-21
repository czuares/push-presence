'use strict';

var pushPresenceApp = angular.module('pushPresenceApp', ['ui.bootstrap', 'frapontillo.bootstrap-switch']);

pushPresenceApp.controller('OptionsCtrl', ['$scope', '$window',
  function($scope, $window) {

    $scope.online = navigator.onLine;
    $scope.DaysOfWeek = $window.DaysOfWeek;

    var initModel = new DataModel();
    $scope.model = angular.copy(initModel);
    $scope.config = new ConfigurationModel();

    var init = function() {
      chrome.storage.sync.get($scope.config, function(items) {
        console.log('Binding config from synced storage');
        $scope.config = items;
        loadApiKey();

        $scope.$apply();
      });

      chrome.storage.local.get($scope.model, function(items) {
        console.log('Binding data model from local storage');
        $scope.model = items;

        $scope.$apply();
      });
    };

    var onlineStateChanged = function(online) {
      $scope.$apply(function() {
        console.log((online ? 'on' : 'off') + 'line at ' + new Date());
        $scope.online = online;
      });
    };

    var loadApiKey = function() {
      PushBullet.APIKey = $scope.config.pushBulletApiToken;
      console.log('api key set');
    };

    var getDevices = function() {
      console.log('Populating devices');
      PushBullet.devices(function(err, res) {
        if (err) {
          console.log(err);
          return;
        }

        //TODO: add/remove new/old

        console.log(res.devices);
        $scope.model.subscriptions = _.chain(res.devices)
          .where({
            active: true
          }).map(function(data) {
            return new Subscription(data);
          }).value();

        $scope.$apply();
      });
    };

    var resetData = function() {
      if (!window.confirm("Warning!\n\nAll of your saved data will be erased. Are you sure you want to continue?"))
        return;

      console.log('Resetting models');
      $scope.model = new DataModel();
      $scope.config = new ConfigurationModel();

      saveConfig();
      //no need to save model - watch handles this
    };

    var saveConfig = function() {
      chrome.storage.sync.set($scope.config, function() {
        console.log('Saved config');
        $scope.$apply();
      });
    }

    var saveModel = function() {
      chrome.storage.local.set($scope.model, function() {
        $scope.saveStatus = 'Saved';
        $window.setTimeout(function() {
          $scope.saveStatus = '';
          $scope.$apply();
        }, 2000);
        console.log('Saved data model');
        $scope.$apply();
      });
    };

    $window.addEventListener("offline", function() {
      onlineStateChanged(false);
    }, false);
    $window.addEventListener("online", function() {
      onlineStateChanged(true);
    }, false);

    chrome.storage.onChanged.addListener(function(changes, areaName) {
      console.log(areaName + ' data changed - reloading');
      init();
    });

    $scope.$watch('model', function(newValue, oldValue) {
      if (newValue === oldValue)
        return;

      //hack for preventing model from saving on load
      if (initModel != null) {
        if (angular.equals(initModel, oldValue)) {
          initModel = null;
          return;
        }
      }

      console.log('Model changed');
      saveModel();
    }, true);

    init();

    $scope.RevokeApiToken = function() {
      if (!$scope.ApiKeySet()) {
        return;
      }
      resetData();
    };

    $scope.ApiKeySet = function() {
      return $scope.config.pushBulletApiToken.length == 32;
    };

    $scope.SetToken = function() {
      if (!$scope.ApiKeySet())
        return;

      loadApiKey();
      getDevices();
      saveConfig();
    };

    $scope.GetDeviceIcon = function(sub) {
      if (!sub) return 'question-sign';
      //console.log('Device type: ' + device.type);

      switch (sub.device.type) {
        case 'chrome':
          return 'globe';
        default:
          return 'phone';
          // case 'ios':
          // case 'iphone':
          // case 'android':
          //   break;
      }
    };

    $scope.GetDeviceName = function(sub) {
      if (!sub) return 'Unknown';
      return sub.device.name;
    };

    $scope.DeviceSelected = function() {
      console.log('Selected device ' + $scope.deviceId);
    };

    $scope.RefreshDevices = function() {
      if (!window.confirm("New devices will be added and stale devices will be removed.\n\nWould you like to continue?"))
        return;
      getDevices();
    };

  }
]);

pushPresenceApp.directive('isodatestring', function() {
  return {
    //hack to handle chrome storage not persisting date objects
    //https://stackoverflow.com/a/12947995
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attr, ngModel) {
      ngModel.$parsers.push(function(date) {
        return new Date(date).toISOString();
      });
    }
  };
});

pushPresenceApp.directive('appSubscription', function() {
  return {
    restrict: 'E',
    scope: {
      model: "=data"
    },
    link: function($scope, $parent, element, attrs) {
      $scope.AddTimeframe = function() {
        $scope.model.timeframes.push(new Timeframe());
      };

      $scope.RemoveTimeFrame = function(idx) {
        console.log('index: ' + idx);
        $scope.model.timeframes.splice(idx, 1);
      };

      $scope.DayName = function(day) {
        return $scope.$parent.DaysOfWeek[day.id];
      };

      $scope.GetScheduleName = function(timeframe) {
        if (timeframe.allDay) {
          return "All Day Every Day";
        }
        return "Custom Schedule";
      };

      $scope.TestPush = function(deviceId) {
        if (!deviceId) return;

        var res = PushBullet.push('note', deviceId, null, {
          title: 'Test from PushPresence',
          body: 'Test Notification'
        });
        console.log(res);
      };

      $scope.OnAllDayChanged = function(idx) {
        console.log('Timeframe changed');
        var timeframe = $scope.model.timeframes[idx];
        if (timeframe.allDay) {
          $scope.model.timeframes[idx] = new Timeframe();
        }
      };

      $scope.GetPlaceHolderText = function(evt) {
        var title = capitalize(evt.eventType);
        if (evt.subscribed) {
          return title;
        } else {
          return title + " (Enable event to customize message)";
        }
      };
    },
    templateUrl: '../templates/subscription.html'
  };
});

pushPresenceApp.filter('capitalize', function() {
  return capitalize;
});

var capitalize = function(input, all) {
  //uses prototype method found in datamodel.js
  return (!!input) ? input.capitalize() : '';
};
