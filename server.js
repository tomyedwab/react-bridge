var _ = require('underscore'),
    bodyParser = require('body-parser'),
    express = require('express'),
    https = require('https'),
    jsdom = require('jsdom').jsdom,
    util = require('util'),
    vm = require('vm'),
    fs = require('fs');

var app = express();

app.use(bodyParser({limit: '50mb'}));

app.get('/', function(req, res) {
    res.send('Hello, World');
});

var fetchScriptHttps = function(script, success, error) {
    console.log("Loading ", script);
    // TODO(tom) Validate this is a valid KA url
    var req = https.request(script,
        function(scriptRes) {
            var scriptSrc = "";
            scriptRes.setEncoding('utf8');
            scriptRes.on('data', function(chunk) {
                scriptSrc += chunk.toString();
            });
            scriptRes.on('end', function() {
                success(scriptSrc);
            });
        });
    req.end();
};

var fetchScriptFile = function(script, success, error) {
    console.log("Loading ", script);
    fs.readFile(script, 'utf8', function(err, data) {
        if (err) {
            error(err);
        }
        success(data);
    });
};

var chain = function(fn, scriptList, success, error, accum) {
    accum = accum || [];
    fn(scriptList[0], function(data) {
        accum.push([scriptList[0], data]);
        if (scriptList.length > 1) {
            chain(fn, scriptList.slice(1), success, error, accum);
        } else {
            success(accum);
        }
    }, error);
};

    
app.post('/render', function(req, res) {
    var moduleToLoad = req.body.module;
    var params = req.body.params;
    var scriptsToFetch = req.body.packages;

    // Init sandbox
    // Create a browser-like environment for initial setup code to work
    var sandbox = {
        document: jsdom("hello world"),
        setTimeout: function() {},
        navigator: { userAgent: "" },
        location: { href: "", search: "" },
        console: console,
        alert: function(text) {
            console.log("ALERT!", text);
        },
        _moduleToLoad: moduleToLoad,
        _params: params
    };
    sandbox.window = sandbox;
    context = vm.createContext(sandbox);

    // Load the scripts
    chain(fetchScriptHttps, scriptsToFetch, function(scriptSources) {
        try {
            for (var i = 0; i < scriptSources.length; i++) {
                vm.runInContext(scriptSources[i][1], context, scriptSources[i][0]);
            }
        } catch(e) {
            console.error(e);
            return;
        }

        // Mock out a dummy $.ajax()
        vm.runInContext(
            "var $ = KAdefine.require('jquery');" +
            "$.ajax = function() { return $.Deferred().promise(); }",
            context);

        // Load the component class, render & return the rendered HTML
        vm.runInContext(
            "var React = KAdefine.require('react');" +
            "var component = React.createFactory(KAdefine.require(_moduleToLoad));" +
            "window.renderedOutput = React.renderToString(component(_params))",
            context);

        // Return the rendered HTML
        res.send(context.renderedOutput);
    }, function(e) {
        console.error(e);
    });
});

var server = app.listen(2380, function() {
    var host = server.address().address;
    var port = server.address().port;
    console.log('React service listening at http://%s:%s', host, port);
});
