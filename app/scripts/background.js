'use strict';

console.log('Events');

var model = new DataModel();
var lastState = null;

chrome.runtime.onInstalled.addListener(function (details) {
  console.log('previousVersion', details.previousVersion);
});

chrome.storage.onChanged.addListener(function () {/*changes, areaName*/
  init();
});

chrome.idle.onStateChanged.addListener(function (newstate) {
  console.log('State changed to ' + newstate);

  var monitored = false;
  for (var name in model.subscribedEvents) {
    if (name === newstate) {
      monitored = model.subscribedEvents[name];
      console.log(name + ' subscribed: ' + monitored);
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


  if (model.isQuietHours()) {
    console.log('It\'s quiet hours. Not sending notification');
    return;
  }

  var msgTitle = 'PushPresence update';
  var state = navigator.onLine ? '' : '[Offline] ';

  var opt = {
    type: 'basic',
    title: state + msgTitle,
    message: 'New State: ' + newstate.capitalize(),
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

  if (model.isValid()) {
    console.log('Sending push');
    var res = PushBullet.push('note', model.deviceId, null, {
      title: opt.title,
      body: opt.message
    });
    console.log(res);
  }
});

function init() {
  model.loadFromStorage(function (items) {
    console.log('got items from storage');
    model = items;
    PushBullet.APIKey = items.pushBulletApiToken;

    console.log('Data valid ' + model.isValid());
  });
}

String.prototype.capitalize = function () {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

init();
