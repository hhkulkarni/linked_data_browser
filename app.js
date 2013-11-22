/*
 * Module dependencies
 */
var express = require('express')
    , stylus = require('stylus')
    , nib = require('nib')
    , SparqlClient = require('sparql-client')
    , util = require('util')
    , rdfstore = require('rdfstore')
    , fs = require('fs')
    , XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

var app = express()
function compile(str, path) {
    return stylus(str)
        .set('filename', path)
        .use(nib())
}
app.set('views', __dirname + '/views')
app.set('view engine', 'jade')
app.use(express.logger('dev'))
app.use(stylus.middleware(
    { src: __dirname + '/public'
        , compile: compile
    }
))
app.use(express.static(__dirname + '/public'));

console.log("Entering execute");

executeSparqlrdfstore();



function executeSparqlrdfstore()
{

    var uriString = "<http://dbpedia.org/resource/University_of_Southern_California>";
    rdfstore.create(function(store) {
        console.log("IN execute\n\n\n\n\n\n\n");
        
        var endpoint = 'http://dbpedia.org/sparql';

        var query1="Construct { "+uriString+" ?p ?o. ?o rdfs:label ?lbl. ?o foaf:depiction ?dep. ?p rdfs:label ?plbl} where { "+uriString+" ?p ?o. OPTIONAL{?o rdfs:label ?lbl}. OPTIONAL{?o foaf:depiction ?dep} OPTIONAL{?p rdfs:label ?plbl} }";


        var query=encodeURIComponent(query1);
        var url="http://dbpedia.org/sparql?query=" + query + "&format=text%2Fturtle";
        var xmlHttp = null;
        console.log("BEFORE XMLHTTPREQUEST11");
        xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = ProcessRequest;
        xmlHttp.open( "GET", url, false );
        xmlHttp.send(null);
        console.log("AFTER SEND");
        function ProcessRequest()
        {
            console.log("IN ProcessRequest()");
            if ( xmlHttp.readyState == 4 && xmlHttp.status == 200 )
            {
                console.log("CHECKING READYSTATE1");

                var results = xmlHttp.responseText;
          
                store.setPrefix("ex", "http://example.org/");
                store.load("text/turtle", results, function(suc, rs){
                   
                    store.execute('PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#> PREFIX foaf: <http://xmlns.com/foaf/0.1/> PREFIX : <http://example.org/> SELECT ?x ?y ?z where {?x ?y ?z. FILTER(?x='+uriString+')} ORDER BY ?y', function(success, results) {         
                        console.log(results);
                        convertJSONintoRequiredFormatNEW(results, store);
                    });
                });
            }
        }
    })
}




//FINAL WORKING JSON
function convertJSONintoRequiredFormatNEW(jsonResult, store)
{
    var internalURI = "http://dbpedia.org/";
    var prefLanguage = "en";
    var jsonItem;
    var convertedJSON = '[';
    for (i in jsonResult)
    {
        if(jsonItem == jsonResult[i].y.value)
        {
            if(jsonResult[i].z.token == 'literal')
            {
                convertedJSON = convertedJSON + '{type:\"literal\", value:';
                convertedJSON = convertedJSON + '\"' + escape(jsonResult[i].z.value) + '\"' + '},';
            }
            else if(jsonResult[i].z.token == 'uri')
            {
                if(jsonResult[i].z.value.indexOf(internalURI) !== -1)
                {
                    convertedJSON = convertedJSON + '{type:\"internaluri\",';
                    var intURI = jsonResult[i].z.value;
                    store.execute('PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#> PREFIX foaf: <http://xmlns.com/foaf/0.1/> PREFIX : <http://example.org/> SELECT ?l where {?z rdfs:label ?l. FILTER(?z=<'+intURI+'>) FILTER (lang(?l)="'+prefLanguage+'") } ', function(success, resultsLBL) {
                        console.log("\nLABEL=="+JSON.stringify(resultsLBL));
                        var lblJSON = eval('(' + JSON.stringify(resultsLBL[0]) + ')');
                        console.log("\nLABEL=="+JSON.stringify(lblJSON));
                        var lblCnt = 0;
                        var lblArray = '';
                        for (var p = 0; p < resultsLBL.length; p++) {
                            for (name in resultsLBL[p]) {
                                lblArray = lblArray + '\"' + escape(resultsLBL[p][name]["value"]) + '\",'
                                lblCnt = lblCnt+1;
                            }
                        }

                        if(lblCnt > 0)
                        {
                            lblArray = lblArray.substring(0,lblArray.length-1);
                            lblArray = 'label:'+ '[' + lblArray + '],';
                            convertedJSON = convertedJSON + lblArray;
                        }
                        else
                        {
                            var URIvalue = jsonResult[i].z.value;

                            URIvalue = URIvalue.substring(URIvalue.lastIndexOf("/")+1);
                            URIvalue = URIvalue.replace("_"," ");

                            lblArray = 'label:'+ '[\"' + escape(URIvalue) + '\"],';
                            convertedJSON = convertedJSON + lblArray;

                        }

                    });

                    store.execute('PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#> PREFIX foaf: <http://xmlns.com/foaf/0.1/> PREFIX : <http://example.org/> SELECT ?d where {?z foaf:depiction ?d. FILTER(?z=<'+intURI+'>)} ', function(success, resultsDEP) {
                        var depJSON = eval('(' + JSON.stringify(resultsDEP[0]) + ')');
                        console.log("\nDEPICTION="+JSON.stringify(resultsDEP));

                        var depCnt = 0;
                        var depArray = '';

                        for (var p = 0; p < resultsDEP.length; p++) {
                            for (name in resultsDEP[p]) {
                                depArray = depArray + '\"' + escape(resultsDEP[p][name]["value"]) + '\",'
                                depCnt = depCnt+1;
                            }
                        }

                        if(depCnt > 0)
                        {
                            depArray = depArray.substring(0,depArray.length-1);
                            depArray = 'depiction:'+ '[' + depArray + '],';
                            convertedJSON = convertedJSON + depArray;
                        }

                    });
                    convertedJSON = convertedJSON + 'value:'+'\"' + escape(jsonResult[i].z.value) + '\"' + '},';
                }
                else
                {
                    convertedJSON = convertedJSON + '{type:\"externaluri\", value:';
                    convertedJSON = convertedJSON + '\"' + escape(jsonResult[i].z.value) + '\",';

                    var URIvalue = jsonResult[i].z.value;
                    var lIndex = 0;
                    if((URIvalue.substring(URIvalue.lastIndexOf("/"))).length > 2)
                    {
                        lIndex = URIvalue.lastIndexOf("/")
                    }
                    else
                    {
                        lIndex = (URIvalue.substring(0, URIvalue.lastIndexOf("/")-1)).lastIndexOf("/");
                    }
                    URIvalue = URIvalue.substring(lIndex+1);
                    URIvalue = URIvalue.replace("_"," ");
                    URIvalue = URIvalue.replace("/"," ");

                    lblArray = 'label:'+ '[\"' + escape(URIvalue) + '\"],';
                    convertedJSON = convertedJSON + lblArray + '},';
                }
            }
        }
        else
        {
            if(!!jsonItem)
            {
                convertedJSON = convertedJSON.substring(0,convertedJSON.length-1);
                convertedJSON = convertedJSON + ']},';
            }
            jsonItem = jsonResult[i].y.value;
            convertedJSON = convertedJSON + '{uri:\"' + encodeURI(jsonResult[i].y.value) + '\",';
            if(jsonItem.indexOf(internalURI) !== -1)
            {
                store.execute('PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#> PREFIX foaf: <http://xmlns.com/foaf/0.1/> PREFIX : <http://example.org/> SELECT ?l where {?z rdfs:label ?l. FILTER(?z=<'+jsonItem+'>) FILTER (lang(?l)="'+prefLanguage+'") } ', function(success, resultsLBL) {

                    var lblJSON = eval('(' + JSON.stringify(resultsLBL[0]) + ')');
                    var lblCnt = 0;
                    var lblArray = '';

                    for (var p = 0; p < resultsLBL.length; p++) {
                        for (name in resultsLBL[p]) {
                            lblArray = lblArray + '\"' + escape(resultsLBL[p][name]["value"]) + '\",'
                            lblCnt = lblCnt+1;
                        }
                    }

                    if(lblCnt > 0)
                    {
                        lblArray = lblArray.substring(0,lblArray.length-1);
                        lblArray = 'label:'+ '[' + lblArray + '],';
                        convertedJSON = convertedJSON + lblArray;
                    }
                    else
                    {
                        var URIvalue = jsonItem;
                        URIvalue = URIvalue.substring(URIvalue.lastIndexOf("/")+1);
                        URIvalue = URIvalue.replace("_"," ");
                        lblArray = 'label:'+ '[\"' + escape(URIvalue) + '\"],';
                        convertedJSON = convertedJSON + lblArray;
                    }

                });
            }
            else
            {
                var URIvalue = jsonItem;
                var lIndex = 0;
                if((URIvalue.substring(URIvalue.lastIndexOf("/"))).length > 2)
                {
                    lIndex = URIvalue.lastIndexOf("/")
                }
                else
                {
                    lIndex = (URIvalue.substring(0, URIvalue.lastIndexOf("/")-1)).lastIndexOf("/");
                }
                URIvalue = URIvalue.substring(lIndex+1);
                URIvalue = URIvalue.replace("_"," ");
                URIvalue = URIvalue.replace("/"," ");

                lblArray = 'label:'+ '[\"' + escape(URIvalue) + '\"],';
                convertedJSON = convertedJSON + lblArray;
            }

            convertedJSON = convertedJSON + 'values:[';
            if(!!jsonResult[i].z.value)
            {
                if(jsonResult[i].z.token == 'literal')
                {
                    convertedJSON = convertedJSON + '{type:\"literal\", value:';
                    convertedJSON = convertedJSON + '\"' + escape(jsonResult[i].z.value) + '\"' + '},';
                }
                else if(jsonResult[i].z.token == 'uri')
                {
                    if(jsonResult[i].z.value.indexOf(internalURI) !== -1)
                    {
                        convertedJSON = convertedJSON + '{type:\"internaluri\",';
                        var intURI = jsonResult[i].z.value;
                        store.execute('PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#> PREFIX foaf: <http://xmlns.com/foaf/0.1/> PREFIX : <http://example.org/> SELECT ?l where {?z rdfs:label ?l. FILTER(?z=<'+intURI+'>) FILTER (lang(?l)="'+prefLanguage+'") } ', function(success, resultsLBL) {
                            var lblJSON = eval('(' + JSON.stringify(resultsLBL[0]) + ')');
                            console.log("\nLABEL="+JSON.stringify(lblJSON));

                            var lblCnt = 0;
                            var lblArray = '';


                            for (var p = 0; p < resultsLBL.length; p++) {
                                for (name in resultsLBL[p]) {
                                    lblArray = lblArray + '\"' + escape(resultsLBL[p][name]["value"]) + '\",'
                                    lblCnt = lblCnt+1;
                                }
                            }

                            if(lblCnt > 0)
                            {
                                lblArray = lblArray.substring(0,lblArray.length-1);
                                lblArray = 'label:'+ '[' + lblArray + '],';
                                convertedJSON = convertedJSON + lblArray;
                            }

                            else
                            {
                                var URIvalue = jsonResult[i].z.value;
                                URIvalue = URIvalue.substring(URIvalue.lastIndexOf("/")+1);
                                URIvalue = URIvalue.replace("_"," ");
                                lblArray = 'label:'+ '[\"' + escape(URIvalue) + '\"],';
                                convertedJSON = convertedJSON + lblArray;
                            }
                        });

                        store.execute('PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#> PREFIX foaf: <http://xmlns.com/foaf/0.1/> PREFIX : <http://example.org/> SELECT ?d where {?z foaf:depiction ?d. FILTER(?z=<'+intURI+'>)} ', function(success, resultsDEP) {
                            var depJSON = eval('(' + JSON.stringify(resultsDEP[0]) + ')');
                            var depCnt = 0;
                            var depArray = '';
                            for (var p = 0; p < resultsDEP.length; p++) {
                                for (name in resultsDEP[p]) {
                                    depArray = depArray + '\"' + escape(depJSON[name]["value"]) + '\",'
                                    depCnt = depCnt+1;
                                }
                            }
                            if(depCnt > 0)
                            {
                                depArray = depArray.substring(0,depArray.length-1);
                                depArray = 'depiction:'+ '[' + depArray + '],';
                                convertedJSON = convertedJSON + depArray;
                            }


                        });
                        convertedJSON = convertedJSON + 'value:'+'\"' + escape(jsonResult[i].z.value) + '\"' + '},';
                    }
                    else
                    {
                        convertedJSON = convertedJSON + '{type:\"externaluri\", value:';
                        convertedJSON = convertedJSON + '\"' + escape(jsonResult[i].z.value) + '\",';
                        var URIvalue = jsonResult[i].z.value;
                        var lIndex = 0;
                        if((URIvalue.substring(URIvalue.lastIndexOf("/"))).length > 2)
                        {
                            lIndex = URIvalue.lastIndexOf("/")
                        }
                        else
                        {
                            lIndex = (URIvalue.substring(0, URIvalue.lastIndexOf("/")-1)).lastIndexOf("/");
                        }
                        URIvalue = URIvalue.substring(lIndex+1);
                        URIvalue = URIvalue.replace("_"," ");
                        URIvalue = URIvalue.replace("/"," ");

                        lblArray = 'label:'+ '[\"' + escape(URIvalue) + '\"],';
                        convertedJSON = convertedJSON + lblArray + '},';
                    }
                }
            }
        }
    }
    convertedJSON = convertedJSON.substring(0,convertedJSON.length-1);
    convertedJSON = convertedJSON + ']}]';

    console.log(convertedJSON);
    displaySparql(eval('(' + convertedJSON + ')'));

}







function displaySparql(jsonData)
{
    app.get('/', function (req, res) {
        res.render('index',
            { param1 : "Smithsonian Data",
                json: jsonData}
        )
    })
}
app.listen(3000)
