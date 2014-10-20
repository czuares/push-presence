'use strict';

console.log('Events');

var model = new DataModel();
var lastState = null;

chrome.runtime.onInstalled.addListener(function (details) {
  console.log('previousVersion', details.previousVersion);
});

chrome.storage.onChanged.addListener(function () {/*changes, areaName*/
  console.log('data changed - reloading');
  init();
});

chrome.idle.onStateChanged.addListener(function (newstate) {
  onEvent(newstate);
});

var onEvent = function(newstate){
  console.log('State changed to ' + newstate);

  var monitored = false;
  for (var idx in model.subscribedEvents) {
    var name = model.subscribedEvents[idx];
    if (name === newstate) {
      monitored = true;
      console.log('subscribed: ' + name);
      break;
    }
  }

  if (lastState === null) {
    lastState = newstate;
  } else if (lastState === newstate) {
    console.log('State hasn\'t changed. Still ' + newstate);
    return;
  }

  if (!monitored) {
    console.log('Event ' + newstate + ' is not subscribed. Not sending notification');
    return;
  }

  //only update if monitored to avoid state changes when not wanted
  lastState = newstate;


  if (isQuietHours(model)) {
    console.log('It\'s quiet hours. Not sending notification');
    return;
  }

  var msgTitle = 'PushPresence update';
  var state = navigator.onLine ? '' : '[Offline] ';

  var opt = {
    type: 'basic',
    title: state + msgTitle,
    message: newstate.capitalize(),
    priority: 1,
    iconUrl: '../images/icon-128.png'
  };

  chrome.notifications.create('id', opt, function (id) {
    console.log('Notification created ' + id + ' at ' + new Date());
  });

  if (!navigator.onLine) {
    console.log('not online - not sending push');
    return;
  }

  if (isValid(model)) {
    console.log('Sending push');
    var res = PushBullet.push('note', model.deviceId, null, {
      title: opt.title,
      body: opt.message
    });
    console.log(res);
  }
};

var isValid = function (model) {
  if ((model.deviceId) && (PushBullet.APIKey)){
    return true;
  }
  return false;
};

var isQuietHours = function (model) {
  if (!model.timeFrameStart || !model.timeFrameEnd) {
    //missing values - not using
    return false;
  }

  var startTime = new Date(model.timeFrameStart);
  var endTime = new Date(model.timeFrameEnd);

  var begin = new Date();
  begin.setHours(startTime.getHours());
  begin.setMinutes(startTime.getMinutes());
  begin.setSeconds(0);

  var end = new Date();
  end.setHours(endTime.getHours());
  end.setMinutes(endTime.getMinutes());
  end.setSeconds(0);

  var now = new Date().getTime();

  if (now >= begin.getTime() && now <= end.getTime()) {
    console.log('within range');
    return false;
  }

  console.log('not within range');
  return true;
};

function init() {
  chrome.storage.sync.get(model, function(items){
    console.log('got items from storage');
    model = items;
    PushBullet.APIKey = items.pushBulletApiToken;
  });
}

init();
