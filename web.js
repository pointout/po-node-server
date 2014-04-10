var apn = require('apn');

// web.js
var express = require("express");
var logfmt = require("logfmt");
var app = express();
var iron_mq = require('iron_mq');
var imq = new iron_mq.Client();
var uuid = require('node-uuid');

app.use(logfmt.requestLogger());
app.use(express.bodyParser());

app.post('/notify/:device', function (req, res) {

    console.log(req);

    var device = req.params.device;
    var message = req.body.message;

    console.log("Sending : " + message + " to " + device);

    var options = { "gateway": "gateway.sandbox.push.apple.com" };
    var apnConnection = new apn.Connection(options);

    var myDevice = new apn.Device(device);
    var note = new apn.Notification();
    note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
    note.badge = 3;
    note.sound = "ping.aiff";
    note.alert = message;
    note.payload = {'messageFrom': 'Caroline'};
    apnConnection.pushNotification(note, myDevice);

    console.log("Sent : " + message + " to " + device);

    res.send('Hello World!');

});

app.post('/user', function (req, res) {

    var mobile = req.body.mobile;
    var device = req.body.device;

    var queue = imq.queue(mobile);
    var push_queue = imq.queue(mobile + '_push');

    queue.post(
        [
            {body: "welcome", timeout: 40},
        ],
        function (error, body) {
        });

    push_queue.post(
        [
            {body: "welcome", timeout: 40},
        ],
        function (error, body) {
        });

    push_queue.update(
        {push_type: "multicast",
            retries: 5,
            subscribers: [
                {
                    url: "http://pushtact-server.herokuapp.com/notify/" + device,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                },
                {
                    url: "ironmq:///" + mobile,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            ]},
        function (error, body) {
        });

    res.send('Hello World!');
});


app.post('/item', function (req, res) {

    var creator = req.body.creator;
    var members = req.body.members;

    var itemId = uuid.v4();

    var push_queue = imq.queue(itemId + '_push');

    push_queue.post(
        [
            {body: "welcome", timeout: 40},
        ],
        function (error, body) {
        });

    var subscribers = [];
    members.forEach(function (member) {
        subscribers.push(
            {
                url: "ironmq:///" + member + "_push",
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    });
    subscribers.push({
        url: "ironmq:///" + creator + "_push",
        headers: {
            'Content-Type': 'application/json'
        }
    });

    push_queue.update(
        {
            push_type: "multicast",
            retries: 5,
            subscribers: subscribers
        },
        function (error, body) {
        });

    result = {};
    result.itemId = itemId;

    res.send(result);
});

app.post('/user/:userId', function (req, res) {

    var userId = req.params.userId;
    var body = req.body;

    console.log(body);
    console.log(userId);

    var push_queue = imq.queue(userId + '_push');

    push_queue.post(
        [
            {body: JSON.stringify(body), timeout: 40},
        ],
        function (error, body) {
        });

    result = {};

    res.send(result);
});

app.post('/item/:itemId', function (req, res) {

    var itemId = req.params.itemId;
    var body = req.body;

    console.log(body);
    console.log(itemId);

    var push_queue = imq.queue(itemId + '_push');

    push_queue.post(
        [
            {body: JSON.stringify(body), timeout: 40},
        ],
        function (error, body) {
        });

    result = {};

    res.send(result);
});


var port = Number(process.env.PORT || 5000);

app.listen(port, function () {
    console.log("Listening on " + port);
});
