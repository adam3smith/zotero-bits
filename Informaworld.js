{
        "translatorID": "1885b93c-cf37-4b25-aef5-283f42eada9d",
        "label": "Informaworld",
        "creator": "Michael Berkowitz",
        "target": "^http://www\\.informaworld\\.com",
        "minVersion": "1.0.0b4.r5",
        "maxVersion": "",
        "priority": 100,
        "inRepository": true,
        "translatorType": 4,
        "lastUpdated": "2011-06-22 23:21:54"
}

/* Test URLs
Book section:
Book:
  http://www.informaworld.com/smpp/title~db=all~content=t777453493
Journal article:
  http://www.informaworld.com/smpp/content~content=a903855250&db=all
Journal issue ToC:
  http://www.informaworld.com/smpp/title~db=all~content=g921992177
*/

function detectWeb(doc, url) {
	if (url.indexOf("quicksearch") !== -1 ||
            (url.indexOf("title~db") !== -1
                && !doc.evaluate('//div[@id="breadcrumb"]/a[text() = "Books"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext())) {
		return "multiple";
	} else if (url.indexOf("content=g") != -1 || 
			doc.evaluate('//div[@id="browse"]//tbody/tr/td[2]/a[2]', doc, null, XPathResult.ANY_TYPE, null).iterateNext() ||
			doc.evaluate('//div[@id="title"]//td[2]/div/strong/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//a[substring(text(), 2, 8) = "Download"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext() ||
            doc.evaluate('//div[@id="breadcrumb"]/a[text() = "Journals" or text() = "Books"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext() ) {
		if (doc.evaluate('//img[substring(@title, 1, 17) = "Publication type:"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var pubtype = doc.evaluate('//div[@id="breadcrumb"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext().title;
			if (pubtype.match("journal")) {
				return "journalArticle";
			} else if (pubtype.match("book")) {
				return "bookSection";
			}
		} else {
            if (doc.evaluate('//div[@id="breadcrumb"]/a[text() = "Books"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
                return "book";
            }
			// Default to journal article
			return "journalArticle";
		}
	} else {
		return false;
	}
}


function doWeb(doc, url) {
	// Scrape some data from page
	var getDocumentData = function (newDoc, data) {
		var xpath = '//div[@id="metahead"]/div';
		var stuff = newDoc.evaluate(xpath, newDoc, null, XPathResult.ANY_TYPE, null);
		var thing = stuff.iterateNext();
		while (thing) {
			if (thing.textContent.match(/DOI/)) {
				data.doi = Zotero.Utilities.trimInternal(thing.textContent).match(/:\s+(.*)/)[1];
				break;
			}
			thing = stuff.iterateNext();
		}
		// There seem to be multiple page structures
		data.pdfurl = newDoc.evaluate('//div[@id="content"]/div/a[1]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext();
		if (data.pdfurl == null) {
		// If we didn't find the URL there, try elsewhere:
			data.pdfurl = newDoc.evaluate('//a[@title="Download PDF"]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext();
		}
		data.pdfurl = data.pdfurl ? data.pdfurl.href : null; // Don't break on missing PDF
		var id = newDoc.location.href.match(/content=([\w\d]+)/);
		// If URL has DOI rather than id, use navbar link to get id
		if (id[1] == 10) {
			id = newDoc.evaluate('//div[@id="contenttabs"]//a[@title = "Article"]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext();
			if (!id) id = newDoc.evaluate('//a[img[@class="downloadicon" and @title = "Download PDF"]]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext();
            id = id.href.match(/content=([\w\d]+)/);
		}
		var post = 'tab=citation&selecteditems=' + id[1].substr(1) + '&content=' + id[1] + '&citstyle=refworks&showabs=false&format=file';
		data.postdata = post;
	}
	
	
	var sets = [];
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.evaluate('//div[@id="quicksearch"]//tr/td/b/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = '//div[@id="quicksearch"]//tr/td/b/a';
		} else if (doc.evaluate('//div[@id="title"]/table/tbody/tr[2]//strong/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = '//div[@id="title"]/table/tbody/tr[2]//strong/a';
		} else if (doc.evaluate('//div[@id="browse"]//tbody/tr/td[2]/a[2]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = '//div[@id="browse"]//tbody/tr/td[2]/a[2]';
		} else if (doc.evaluate('//div[@id="title"]//td[2]/div/strong/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = '//div[@id="title"]//td[2]/div/strong/a';
		} else if (doc.evaluate('//div[@id="title"]/table//tr[2]/td/table//tr/td[2]/b/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = '//div[@id="title"]/table//tr[2]/td/table//tr/td[2]/b/a';
		} else if (doc.evaluate('//a[@title="Click to view this record"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
            		var xpath = '//a[@title="Click to view this record"]';
        	}
		
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var title = titles.iterateNext();
		while (title) {
			items[title.href] = title.textContent;
			title = titles.iterateNext();
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			sets.push({ url: i });
		}
	} else {
		// If we're on the citation page, get back to the article page, which has the PDF link
		var newurl = url.replace('~tab=citation', '~tab=content');
		// If we're already on the main page, just pull out data here
		if (newurl == url) {
			sets[0] = {};
			getDocumentData(doc, sets[0]);
			// Dummy first callback, since we already have the data
			var first = function (set, next) {
				next();
			};
		}
		else {
			sets.push({
				url: newurl
			});
		}
	}
	
	if (!first) {
		var first = function (set, next) {
			var url = set.url;
			Zotero.Utilities.processDocuments(url, function(newDoc) {
				getDocumentData(newDoc, set);
				next();
			});
		};
	}
	
	var second = function (set, next) {
		Zotero.Utilities.HTTP.doPost('http://www.informaworld.com/smpp/content', set.postdata, function(text) {
			Zotero.debug(text);
			text = text.replace(/RT/, "TY");
			text = text.replace(/VO/, "VL");
			text = text.replace(/LK/, "UR");
			text = text.replace(/YR/, "PY");
			text = text.replace(/([A-Z][A-Z\d]\s)/g, "$1 - ")
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				var type = text.match(/TY\s+\-\s+([^\n]*)/)[1];
				if (type == "Journal") {
					item.itemType = "journalArticle";
				} else if (type == "Book, Whole") {
					item.itemType = "book";
				} else if (type == "Book, Section") {
					item.itemType = "bookSection";
				}
				if (set.doi) {
					item.DOI = set.doi;
				}
				
				// Remove the existing attachment that the RIS translator gives us
				item.attachments = [];
				
				// Make URLs into DOIs if needed
				if (item.url.match(/10\..*/) && !item.DOI) {
					item.DOI = item.url.match(/10\..*/)[0];
					item.url = "";
				} else {
					// Otherwise make a _link_ and remove the URL from the item
					item.attachments.push({url:item.url, title:"Informaworld Link", snapshot:false});
					item.url = "";
				}
				item.attachments.push({url:set.pdfurl, title:item.title, mimeType:'application/pdf'});
				item.complete();
			});
			translator.translate();
			
			next();
		});
	}
	
	var callbacks = [first, second];
	Zotero.Utilities.processAsync(sets, callbacks, function () { Zotero.done(); });
	Zotero.wait();
}


/** BEGIN TEST CASES **/
var testCases = [
    {
        "type": "web",
        "url": "http://www.informaworld.com/smpp/content~db=all?content=10.1080/00221687509499713",
        "items": [
            {
                "itemType": "journalArticle",
                "creators": [
                    {
                        "lastName": "Savage",
                        "firstName": "S. B.",
                        "creatorType": "author"
                    },
                    {
                        "lastName": "Brimberg",
                        "firstName": "J.",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://www.informaworld.com/smpp/ftinterface~content=a918972008~fulltext=713240930~frm=content",
                        "title": "Analysis Of Plunging Phenomena In Water Reservoirs",
                        "mimeType": "application/pdf"
                    }
                ],
                "publicationTitle": "Journal of Hydraulic Research",
                "title": "Analysis Of Plunging Phenomena In Water Reservoirs",
                "publisher": "Taylor & Francis",
                "ISBN": "0022-1686",
                "ISSN": "0022-1686",
                "date": "1975",
                "volume": "13",
                "issue": "2",
                "pages": "187",
                "url": "",
                "DOI": "10.1080/00221687509499713",
                "libraryCatalog": "Informaworld"
            }
        ]
    },
    {
        "type": "web",
        "url": "http://www.informaworld.com/smpp/title~db=all~content=t777453493",
        "items": [
            {
                "itemType": "book",
                "creators": [
                    {
                        "lastName": "Wisnicki",
                        "firstName": "Adrian",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://www.informaworld.com/978-0-415-95560-7",
                        "title": "Informaworld Link",
                        "snapshot": false
                    },
                    {
                        "url": null,
                        "title": "Conspiracy, Revolution, and Terrorism from Victorian Fiction to the Modern Novel",
                        "mimeType": "application/pdf"
                    }
                ],
                "title": "Conspiracy, Revolution, and Terrorism from Victorian Fiction to the Modern Novel",
                "publisher": "Routledge",
                "ISBN": "978-0-415-95560-7",
                "ISSN": "978-0-415-95560-7",
                "url": "",
                "libraryCatalog": "Informaworld"
            }
        ]
    }
]
/** END TEST CASES **/
