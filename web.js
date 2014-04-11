
// web.js
var express = require("express");
var stylus = require('stylus');
var nib = require('nib');
var logfmt = require("logfmt");

var app = express();
function compile(str, path) {
    return stylus(str)
        .set('filename', path)
        .use(nib())
}
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.logger('dev'));
app.use(stylus.middleware(
    { src: __dirname + '/public'
        , compile: compile
    }
));
app.use(express.static(__dirname + '/public'));

var uuid = require('node-uuid');

var Db = require('mongodb').Db,
    MongoClient = require('mongodb').MongoClient,
    Server = require('mongodb').Server,
    ReplSetServers = require('mongodb').ReplSetServers,
    ObjectID = require('mongodb').ObjectID,
    Binary = require('mongodb').Binary,
    GridStore = require('mongodb').GridStore,
    Code = require('mongodb').Code,
    BSON = require('mongodb').pure().BSON;

var db;

app.use(logfmt.requestLogger());
app.use(express.bodyParser());


app.post('/request/create', function (req, res) {

    var recipients = {};

    req.body.recipients.forEach(function (item) {
       var id = uuid.v4();
       recipients[id] = item;
    });

    var requestId = "";

    db.collection('requests').insert({
        'device': req.body.device,
        'subject': req.body.subject,
        'location': req.body.location,
        'recipients': recipients
    }, function(err, items){
        console.log(items);
        requestId = items[0]._id;
    });

    Object.keys(recipients).forEach(function (recipientId) {
        var address = recipients[recipientId];
        sendMail(
                address,
                "Could you pointout a good " + req.body.subject + " around " + req.body.location,
                "http://localhost:5000/request/" + requestId + "/" + recipientId
        );
    });

    res.send({
        'success': true,
        'requestId': requestId
    });

});

app.post('/request/respond', function (req, res) {

    var requestId = req.body.requestId;
    var recipientId = req.body.recipientId;
    var response = req.body.response;

    console.log(requestId);

    db.collection('requests').update(
        {_id: require('mongodb').ObjectID(requestId)},
        {$push: {responses : {
            'response': response,
            'recipientId': recipientId
        }}},
        {w:1},
    function(err, items){
        console.log(err, items);

        db.collection('requests').findOne(
            {_id: require('mongodb').ObjectID(requestId)},
            function(err, item){
                console.log(item);
                sendIOSNotification(response, item.device);
            });
    });

    res.send({'success': true});

});

app.get('/request/:requestId/:recipientId', function (req, res) {

    var requestId = req.params.requestId;
    var recipientId = req.params.recipientId;

    console.log(requestId);

    db.collection('requests').findOne(
        {_id: require('mongodb').ObjectID(requestId)},
    function(err, item){
        console.log(item);
        res.render('index',
            { title : 'Home', subject: item.subject, location: item.location, requestId: requestId, recipientId: recipientId}
        )
    });

});

app.post('/request/list', function (req, res) {

    var device = req.body.device;

    var response = [];

    db.collection('requests').find({
        'device': device
    }).toArray(function(err, items){
        console.log(items);
        items.forEach(function(item) {
            response.push(item);
        });
        res.send({'success': true, 'response': response});
    });
});


var port = Number(process.env.PORT || 5000);

app.listen(port, function () {
    console.log("Listening on " + port);

    db = new Db('pointout1', new Server("ds039007.mongolab.com", 39007,
        {auto_reconnect: false, poolSize: 4}), {w:0, native_parser: false});


    // Establish connection to db
    db.open(function(err, db) {
        db.authenticate('root', 'root', function(err, result) {

        });
    });

});


// Email Module

var nodemailer = require("nodemailer");

function sendMail(emailId, subject, body) {

    var smtpTransport = nodemailer.createTransport("SMTP",{
        service: "Gmail",
        auth: {
            user: "sivaprakash.ragavan@gmail.com",
            pass: "skE.Haj:Ly@Wop,"
        }
    });

    smtpTransport.sendMail({
        from: "Sivaprakash Ragavan <sivaprakash.ragavan@gmail.com>", // sender address
        to: emailId, // comma separated list of receivers
        subject: subject, // Subject line
        text: body // plaintext body
    }, function(error, response){
        if(error){
            console.log(error);
        }else{
            console.log("Message sent: " + response.message);
        }
    });
}

// Notification Module

var apn = require('apn');

function sendIOSNotification(message, device) {

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
}
