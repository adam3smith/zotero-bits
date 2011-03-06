{
	"translatorID": "c54d1932-73ce-dfd4-a943-109380e06574",
	"label": "Project MUSE",
	"creator": "Simon Kornblith, Avram Lyon",
	"target": "^https?://[^/]*muse\\.jhu\\.edu[^/]*/(?:journals/[^/]+/[^/]+/[^/]+\\.html|search/results)",
	"minVersion": "1.0.0b4.r1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": "1",
	"translatorType": 4,
	"lastUpdated": "2011-03-02 23:38:17"
}

function detectWeb(doc, url) {
	var searchRe = new RegExp("(^https?://[^/]+/search/results|/search/save|/toc/)");
	if(searchRe.test(url)) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var searchRe = new RegExp("^https?://[^/]+/search/results|/search/save");
	if(detectWeb(doc, url) == "multiple") {
		var items = new Array();
		var attachments = new Array();
		var pdfRe = /PDF/;
		var htmlRe = /HTML/;
		if (searchRe.test(url)) { 
			// Search results
			var tableRows = doc.evaluate('//save_form//tr[@class="resultsrow"]',
		                             doc, nsResolver, XPathResult.ANY_TYPE, null);
			var tableRow;
			// Go through table rows
			while(tableRow = tableRows.iterateNext()) {
				var input = doc.evaluate('.//div[@class="links"]//a[last()]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				var title = doc.evaluate('.//div[@class="title"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if(input && input.href && title && title.textContent) {
					items[input.href] = title.textContent;
				}
			}
		} else if (url.match(/\/toc\//)) {
			//Zotero.debug("here");
			var results = doc.evaluate('//div[@class="article"]',
		                             doc, nsResolver, XPathResult.ANY_TYPE, null);
			var result; 
			while(result =  results.iterateNext()) {
				//Zotero.debug(result.textContent);
				var link = doc.evaluate('.//div[@class="links"]/p//a[last()]', result, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				var title = doc.evaluate('.//div[@class="title"]', result, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				//Zotero.debug(link.textContent);
				if(link && link.href && title && title.textContent) {
					items[link.href] = title.textContent;
					//Zotero.debug(link.href);
				}
			}
			// Some journals have old-style TOCs for back issues
			// Ex. http://muse.jhu.edu/journals/eighteenth-century_studies/toc/ecs33.4.html
			if (items.length == 0) {
				var articles = doc.evaluate('//ul', doc, nsResolver, XPathResult.ANY_TYPE, null);
				var article;
				while (article = articles.iterateNext()) {
					var link = doc.evaluate('./li/a[contains(@href,".html")]', article, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					var title = doc.evaluate('./li/i', article, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					//Zotero.debug(link.textContent);
					if(link && link.href && title && title.textContent) {
						items[link.href] = title.textContent;
						//Zotero.debug(link.href);
					}
				} 
			}
		}
		items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		var i;
		var urls = [];
		for (i in items) {urls.push(i);};
		
		Zotero.Utilities.processDocuments(urls, scrapeOne, function() {Zotero.done();});		
	} else scrapeOne(doc);
	Zotero.wait();
}

// Given an article page, get the RIS and open it
function scrapeOne(doc) {
	var url = doc.location.href;
	//Zotero.debug("scrapeOne has "+doc.location.href)
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	

	var hostRe = new RegExp("^(http://[^/]+)/");
		var m = hostRe.exec(url);
		var host = m[1];

		var getPDF = doc.evaluate('//a[text() = "PDF Version"]', doc,
		                          nsResolver, XPathResult.ANY_TYPE, null).iterateNext();		
		var DOI = doc.evaluate('//div[@class="doi"]', doc,
		                          nsResolver, XPathResult.ANY_TYPE, null).iterateNext();		
		var abstract = doc.evaluate('//abstract', doc,
		                          nsResolver, XPathResult.ANY_TYPE, null).iterateNext();		


		var newUrl = url.replace(host, host+"/metadata/zotero").replace("/summary/","/");;
		//Zotero.debug(newUrl);
		Zotero.Utilities.HTTP.doGet(newUrl, function(text) {
			var translator = Zotero.loadTranslator("import");
			//set RIS translator
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			Zotero.debug(text);
			translator.setHandler("itemDone", function(obj, item) {
				if(item.notes && item.notes[0]) {
					item.extra = item.notes[0].note;						
					delete item.notes;
					item.notes = undefined;
				}
				item.attachments.splice(0);
				item.attachments.push({document:doc, title:"Project MUSE Snapshot"});
				if(getPDF) {
					item.attachments.push({title:"Project MUSE Full Text PDF", mimeType:"application/pdf",
					url:getPDF.href});
				}
				if(DOI) {
					item.DOI = DOI.textContent.replace(/^DOI: /,"");
				}
				if(abstract) {
					item.abstract = abstract.textContent;
				}
				item.complete();
			});
			translator.translate();
		});
}
