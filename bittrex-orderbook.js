var bittrex = require('node.bittrex.api');

bittrex.options({
    'stream' : false,
    'verbose' : false,
    'cleartext' : false 
});

/**
 * Uses websockets to keep up to date order books and market summaries for all market pairs.
 * call .connect() with callback to initialize.
 * Use marketSummaries and orderBooks public variables to access data.
 */
function BittrexOrderbook () {
    this.marketSummaries = function(){};   // Holds market summaries
    var orderBooks = function(){};        // Holds order books for all markets
    var pendingUpdates = function(){};     // Holds Nounce updates that have been received out of order
    var nextNounce = function(){};         // Holds next Nounce expected for each order book
    var bookCount = 0;                     // How many orde books have been connected
    var connected = false;                 // Whether the BittrexOrderbook has been connected to Bittrex
    var errors = [];                       // Holds any errors for INVALID_MARKET

    /**
     * Start the connection process.
     * @param {callback} callback function passed from whatever is calling connect. Executed after all order books and market summaries connect.
     */
    this.connect = function(callback){
        if (!connected){
            console.log("Connecting to Bittrex order books and market summaries...");
            connected = true;
            initializeMarketSummaries(callback);
        }
        else console.log("Error: already connected.");
    }.bind(this);

    /**
     * Returns orderbook for given market as object with two sorted arrays of orders.
     */
    this.getOrderBook = function(marketName){
        var sortedOrderBook = function(){}
        var buys = [];
        var sells = [];
        if (orderBooks[marketName] != undefined){
            for (var order in orderBooks[marketName].buy){
                buys.push(orderBooks[marketName].buy[order]);
            }
            for (var order in orderBooks[marketName].sell){
                sells.push(orderBooks[marketName].sell[order]);
            }
            buys.sort(function (a, b){ return ((a.Rate) < (b.Rate)) ? 1 : (((b.Rate) < (a.Rate)) ? -1 : 0); });
            sells.sort(function (a, b){ return ((a.Rate) < (b.Rate)) ? 1 : (((b.Rate) < (a.Rate)) ? -1 : 0); });
            sortedOrderBook.buy = buys;
            sortedOrderBook.sell = sells;
            return sortedOrderBook;
        }
        else {
            console.log("ERROR: " + marketName + " is not a valid order book market.");
        }
    }

    /**
     * Print any errors that have occurred.
     */
    var printErrors = function(){
        for (var err in errors) console.log(errors[err]);
    }.bind(this);

    /** 
     * Adds a market summary to the this.marketSummaries object.
     * @param {marketSummary} summary
    */
    var addSummary = function(summary){
        this.marketSummaries[summary.MarketName] = new marketSummary(summary.MarketName, summary.High, summary.Low,
            summary.Volume, summary.Last, summary.BaseVolume, summary.TimeStamp, summary.Bid, summary.Ask, summary.OpenBuyOrders,
            summary.OpenSellOrders, summary.PrevDay, summary.Created);
    }.bind(this);

    /**
     * Gets all market summaries from Bittrex and starts the websocket subscription process.
     * @param {callback} callback function passed from whatever is calling connect. Executed after all order books and market summaries connect.
     */
    var initializeMarketSummaries = function(callback){
        bittrex.getmarketsummaries( function( data ){
            if (data["success"] == true){
                console.log("Pulled market summaries.");
                var s = data["result"];
                for (var obj in s) if (s[obj].MarketName != undefined && s[obj].Volume != null) addSummary(s[obj]);
                startWebSockets();
                console.log("Pulling all orderBooks (this can take up to 20 seconds)...")
                for (var market in this.marketSummaries) initializeOrderBook(String(this.marketSummaries[market].MarketName), callback);
            }
            else {
                initializeMarketSummaries(callback);
            }
        }.bind(this));
    }.bind(this);

    /**
     * Connects to Bittrex websocket for all markets.
     */
    var startWebSockets = function(){
        var marketArray = [];
        for (var market in this.marketSummaries) marketArray.push(this.marketSummaries[market].MarketName);
        const marketSocket = bittrex.websockets.subscribe(marketArray, function (data) { socketEvent(data); }.bind(this));
        console.log("Connected to websocket");
    }.bind(this);

    /**
     * Requests the given order book from Bittrex and adds to orderBooks structure with market pair as index.
     * @param {string} marketName
     * @param {callback} callback function passed from whatever is calling connect. Executed after all order books and market summaries connect.
     */
    var initializeOrderBook = function(marketName, callback){
        if (marketName == undefined) return;
        bittrex.getorderbook({ market : marketName, depth : 1, type : 'both' }, function( data ) {
            bookCount++;
            if (data.success){
                orderBooks[marketName] = function(){}
                for (var side in data.result){
                    orderBooks[marketName][side] = function(){}
                    for (var listing in data.result[side]) orderBooks[marketName][side][data.result[side][listing].Rate] = new orderListing(data.result[side][listing].Quantity, data.result[side][listing].Rate);
                }
            }
            else {
                errors.push("Error for " + marketName + ": " + JSON.stringify(data));
            }
            if (bookCount == Object.keys(this.marketSummaries).length){
                console.log("Pulled all order books.");
                printErrors();
                callback();
            }
        }.bind(this));
    }.bind(this);

    /**
     * Handles market summary and orderbook update events from the Bittrex websocket.
     * @param {Object} data passed from websocket.
     */
    var socketEvent = function(data){
        if (data.M === 'updateSummaryState'){
            data.A[0].Deltas.forEach(function (data_for) {
                addSummary(data_for);
            }.bind(this));
        }
        else if (data.M === 'updateExchangeState') {
            data.A.forEach(function(data_for) {
                if (orderBooks[data_for.MarketName] != undefined){
                    if (pendingUpdates[data_for.MarketName] == undefined){
                        if (pendingUpdates[data_for.MarketName] == undefined){
                            pendingUpdates[data_for.MarketName] = function(){}
                            nextNounce[data_for.MarketName] = data_for.Nounce;
                        }
                    }
                    pendingUpdates[data_for.MarketName][data_for.Nounce] = new orderbookEdit(data_for.MarketName,
                        data_for.Nounce, data_for.Buys, data_for.Sells, data_for.Fills);
                    var checked = 0;
                    while (checked < Object.keys(pendingUpdates[data_for.MarketName]).length){
                        for (var update in pendingUpdates[data_for.MarketName]){
                            if (nextNounce[data_for.MarketName] == pendingUpdates[data_for.MarketName][update].Nounce){
                                applyNounce(pendingUpdates[data_for.MarketName][update]);
                                delete pendingUpdates[data_for.MarketName][update];
                                checked = 0;
                                break;
                            }
                            checked++;
                        }
                    }
                } 
            }.bind(this));
        }
    }.bind(this);

    /**
     * Applies the passed orderbookEdit object to the appropriate market's orderbook.
     * @param {Object} bookEdit order book edit object of type orderbookEdit.
     */
    var applyNounce = function(bookEdit) {
        for (var edit in bookEdit.Buys){
            if (bookEdit.Buys[edit].Type == 1) delete orderBooks[bookEdit.MarketName].buy[bookEdit.Buys[edit].Rate];
            else orderBooks[bookEdit.MarketName].buy[bookEdit.Buys[edit].Rate] = new orderListing(bookEdit.Buys[edit].Quantity, bookEdit.Buys[edit].Rate);
        }
        for (var edit in bookEdit.Sells){
            if (bookEdit.Sells[edit].Type == 1) delete orderBooks[bookEdit.MarketName].sell[bookEdit.Sells[edit].Rate];
            else orderBooks[bookEdit.MarketName].sell[bookEdit.Sells[edit].Rate] = new orderListing(bookEdit.Sells[edit].Quantity, bookEdit.Sells[edit].Rate);
        }
        nextNounce[bookEdit.MarketName] = bookEdit.Nounce + 1;
    }.bind(this);
}

/**
 * Holds market summary data.
 * @param {string} MarketName 
 * @param {number} High 
 * @param {number} Low 
 * @param {number} Volume 
 * @param {number} Last 
 * @param {number} BaseVolume 
 * @param {string} TimeStamp 
 * @param {number} Bid 
 * @param {number} Ask 
 * @param {number} OpenBuyOrders 
 * @param {number} OpenSellOrders 
 * @param {number} PrevDay 
 * @param {string} Created 
 */
function marketSummary(MarketName, High, Low, Volume, Last, BaseVolume, TimeStamp, Bid, Ask, OpenBuyOrders, OpenSellOrders, PrevDay, Created){
    this.MarketName = MarketName;
    this.High = High;
    this.Low = Low;
    this.Volume = Volume;
    this.Last = Last;
    this.BaseVolume = BaseVolume;
    this.TimeStamp = TimeStamp;
    this.Bid = Bid;
    this.Ask = Ask;
    this.OpenBuyOrders = OpenBuyOrders;
    this.OpenSellOrders = OpenSellOrders;
    this.PrevDay = PrevDay;
    this.Created = Created;
    var result = MarketName.split("-");
    this.currencyA = result[0];
    this.currencyB = result[1];
}

/**
 * Holds single order book entry data.
 * @param {number} Quantity 
 * @param {number} Rate 
 */
function orderListing(Quantity, Rate){
    this.Quantity = Quantity;
    this.Rate = Rate;
}

/**
 * 
 * @param {string} MarketName 
 * @param {number} Nounce 
 * @param {Object} Buys 
 * @param {Object} Sells 
 * @param {Object} Fills 
 */
function orderbookEdit(MarketName, Nounce, Buys, Sells, Fills){
    this.MarketName = MarketName;
    this.Nounce = Nounce;
    this.Buys = Buys;
    this.Sells = Sells;
    this.Fills = Fills;
}

module.exports = BittrexOrderbook;