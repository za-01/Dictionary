const express = require('express');
const app = express();
const util = require('util');
const bodyParser = require('body-parser');
const https = require('https');
const mysql = require("mysql");
const db = mysql.createConnection({
	host: "localhost",
	user: "root",
	password: "oraclemysql",
	database: "oxford",
});

app.use(bodyParser.urlencoded({extended:true}));
db.connect();
app.get("/",function(req,res){
    res.sendFile(__dirname + "/index.html");
});



app.post("/",function(req,res){
    var query = req.body.word;
    query = query.toString();
    query = query.toLowerCase();
    const app_id = "c03dfe40";
    const app_key = "2710b2b3826bc1a0669fcc8ad8c4f16d";
    const strictMatch = false;
    const fields = "definitions";
    const url = "https://od-api.oxforddictionaries.com/api/v2/entries/en-gb/" + query + "?strictMatch=false";
    const options = {
        host: 'od-api.oxforddictionaries.com',
        port: '443',
        path: '/api/v2/entries/en-gb/' + query + '?fields=definitions%2Cetymologies&strictMatch=' + strictMatch,
        method: "GET",
        headers: {
          'app_id': app_id,
          'app_key': app_key
        }
    };
    
    res.write("<h1>Query entered: "+query+"</h1>");
    
    var isLocal = true;
    
    try {
        res.write('<head>');
        res.write('<meta charset="utf-8">');
        res.write('</head>');
        //Checking if the word is in local Database
        db.query("select * from definitions where word = '" + query + "';", (err, result) => {
        if (err) throw err;
        if(result.length==0)
            isLocal = false;
        if(isLocal)
        {
            //Querying from Local Database
            try {
                res.write('<font color="green">');
                res.write("<h1>Queried from Local Database</h1>");
                res.write("</font>");
                db.query("SELECT * FROM info where word='" + query + "';", (err, result) => {
                    res.write("<h1>Lexical Category: "+result[0].cat+"</h1>");
                    res.write("<h1>Etymology: "+result[0].ety+"</h1>");
                });
                db.query("SELECT * FROM definitions where word='" + query + "';", (err, result) => {
                    if (err)
                        throw err;
                    res.write("<h1>Definitions:</h1>");
                    for (let index = 0; index < result.length; index++) {
                        res.write("<h1>"+String(Number(index)+1)+ ") " +result[index].def+"</h1>");
                    }
                    res.send();
                });
            } catch (error) {
            console.log(error);
            }
        }
        else
        {
            //Querying from API and writing into Local Database
            https.get(url,options,function(response){
                response.on("data",function(data){
                try {
                    const dictionarydata = JSON.parse(data);
                    const results = dictionarydata.results
                    var cat = results[0].lexicalEntries[0].lexicalCategory.text;
                    var ety = results[0].lexicalEntries[0].entries[0].etymologies;
                    //console.log(res.statusCode);
                    //console.log(util.inspect(results[0].lexicalEntries[0].entries[0].senses, {showHidden: false, depth: null}))
                    // console.log(util.inspect(dictionarydata, {showHidden: false, depth: null}))
                    res.write('<font color="red">');
                    res.write("<h1>Queried from API</h1>");
                    res.write("</font>");
                    res.write("<h1>Lexical Category: "+cat+"</h1>");
                    if(ety==undefined)
                    res.write("<h1>Etymology: None</h1>");
                    else
                        res.write("<h1>Etymology: "+ety+"</h1>");
                    res.write("<h1>Definitions:</h1>");
                    for (let i = 0; i < results[0].lexicalEntries[0].entries[0].senses.length; i++) {
                        var str = results[0].lexicalEntries[0].entries[0].senses[i].definitions[0];
                        //Making ' as '' to insert in DB
                        var n = str.indexOf("'");
                        if(n!=-1)
                            str = str.substring(0, n) + "'" + str.substr(n);
                        //If no etmyologies
                        if(ety!=undefined)
                        {
                            n = ety.indexOf("'");
                            if(n!=-1)
                                ety = ety.substring(0, n) + "'" + ety.substr(n);
                        }
                        db.query("insert into definitions(word,def) values ('"+query+"','"+str+"');", (err, result) => {
                            if (err) throw err;
                        });
                    
                        res.write("<h1>"+String(Number(i)+1)+ ") " + str + "</h1>");
                    }
                    if(ety!=undefined)
                    {
                        db.query("insert into info(word,cat,ety) values ('"+query+"','"+cat+"','"+ety+"');", (err, result) => {
                            if (err) throw err;
                        });
                    }
                    //If no etmyologies
                    else
                    {
                        db.query("insert into info(word,cat,ety) values ('"+query+"','"+cat+"','None');", (err, result) => {
                            if (err) throw err;
                        });
                    }
                    
                    res.send();
                }catch (error) {
                    console.log(error);
                    const dictionarydata = JSON.parse(data);
                    res.write(dictionarydata.error);
                    res.send();
                }
                });
            });
        }
    });
    } catch (error) {
        console.log(error);
    }
});

app.listen(3000,function(req,res){
    console.log("Server running on port 3000");
})