'use strict';

console.log('Events');

var model = new DataModel();
var config = new ConfigurationModel();

var lastState = null;

chrome.runtime.onInstalled.addListener(function(details) {
  console.log('previousVersion', details.previousVersion);
});

chrome.storage.onChanged.addListener(function(changes, areaName) {
  console.log(areaName + ' data changed - reloading');
  init();
});

chrome.idle.onStateChanged.addListener(function(newState) {
  onEvent(newstate);
});

var onEvent = function(newState) {

  console.log('State changed to ' + newState);

  if (lastState === null) {
    lastState = newState;
  } else if (lastState === newState) {
    console.log('State has not changed. Still ' + newState);
    return;
  }

  lastState = newState;

  if (!model.globalEnabled) {
    console.log('Service is paused');
    return;
  }

  model.subscriptions.forEach(function(sub) {
    var inRange = false;

    sub.timeframes.forEach(function(timeframe) {
      if (!isWithinRange(timeframe))
        continue;

      inRange = true;
      timeframe.events.forEach(function(evt) {
        if (!evt.subscribed) {
          console.log(evt.eventType + ' not subscribed');
          return;
        }

        if (evt.eventType === newState) {
          console.log('subscribed', evt.eventType);
          handleEvent(sub, evt);
        } else {
          console.log(evt.eventType + ' subscribed but not current state');
        }
      });
    });

    if (!inRange) {
      console.log('Not within any range - Not sending notification');
      return;
    }
  });
};

var handleEvent = function(subscription, evt) {
  var msgTitle = 'PushPresence update';
  var state = navigator.onLine ? '' : '[Offline] ';

  var opt = {
    type: 'basic',
    title: state + msgTitle,
    message: evt.eventType.capitalize(),
    priority: 1,
    iconUrl: '../images/icon-128.png'
  };

  chrome.notifications.create('id', opt, function(id) {
    console.log('Notification created ' + id + ' at ' + new Date());
  });

  if (!navigator.onLine) {
    console.log('not online - not sending push');
    return;
  }

  if (isReady(subscription)) {
    console.log('Sending push');
    var res = PushBullet.push('note', subscription.deviceId, null, {
      title: opt.title,
      body: (!!evt.customMessage) ? evt.customMessage : opt.message
    });
    console.log(res);
  }
}

var isReady = function(subscription) {
  return (subscription.deviceId) && (PushBullet.APIKey);
};

var isWithinRange = function(timeframe) {
  if (timeframe.allDay) return true;

  if (!timeframe.begin || !timeframe.end) {
    //missing values - invalid
    return false;
  }

  var dayId = new Date().getDay();
  var isTodayEnabled = timeframe.days.some(function(d) {
    var enabled = (d.id == dayId && d.enabled);
    console.log('enabled ' + d.id + ': ' + enabled);
    return enabled;
  });

  if (!isTodayEnabled) {
    console.log('Not enabled for today - skipping');
    return;
  }

  var startTime = new Date(timeframe.begin);
  var endTime = new Date(timeframe.end);
  var now = new Date().getTime();

  var beginDate = new Date();
  beginDate.setHours(startTime.getHours());
  beginDate.setMinutes(startTime.getMinutes());
  beginDate.setSeconds(0);

  var endDate = new Date();
  endDate.setHours(endTime.getHours());
  endDate.setMinutes(endTime.getMinutes());
  endDate.setSeconds(0);

  var withinRange = (now >= beginDate.getTime() && now <= endDate.getTime());
  console.log('within range: ' + withinRange + ' range: ' + beginDate + ' to ' + endDate);

  if (timeframe.invert) {
    console.log('inverted state: ' + !withinRange);
    return !withinRange;
  }
  return withinRange;
}

function init() {
  chrome.storage.sync.get(config, function(items) {
    console.log('got synced config from storage');
    PushBullet.APIKey = items.pushBulletApiToken;
  });

  chrome.storage.local.get(model, function(items) {
    console.log('got local data from storage');
    model = items;
  });
}

init();
