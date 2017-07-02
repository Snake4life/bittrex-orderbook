# Bittrex Orderbook
The BittrexOrderbook class pulls market summary and order book data for all market pairs from the Bittrex API. After pulling the data it then connects to the websockets for all market pairs to keep the order books and market summaries updated.
## Prerequisite
Install node.bittrex.api package.
```
$ npm install node.bittrex.api
```
## Installation
Copy bittrex-orderbook.js to your project folder.
## Usage
### Initiate connection
```js
const BittrexOrderBook = require('./bittrex-orderbook.js');
const bitman = new BittrexOrderBook();

// Call connect function and provide callback for execution when connection is ready.
bitman.connect( function() {
    console.log("Connections established");
});
```
### Market Summaries
Access the market summaries through the `marketSummaries` object property.
```js
console.log(bitman.marketSummaries['BTC-ETH']);
```
Output:
```
marketSummary {
  MarketName: 'BTC-ETH',
  High: 0.112,
  Low: 0.10510007,
  Volume: 33797.98641469,
  Last: 0.1111,
  BaseVolume: 3652.83089315,
  TimeStamp: '2017-07-02T17:26:32.977',
  Bid: 0.11104828,
  Ask: 0.1111,
  OpenBuyOrders: 5616,
  OpenSellOrders: 9488,
  PrevDay: 0.10867183,
  Created: '2015-08-14T09:02:24.817',
  currencyA: 'BTC',
  currencyB: 'ETH' }
```
### Order Books
Access the order books through the `getOrderBooks` object method. This method returns an object with `buy` and `sell` properties, each of which is an array of sorted orderListing objects for that side. The orderListing object has properties `Quantity` and `Rate`.
```js
var btc_ethOrderBook = bitman.getOrderBook('BTC-ETH');
for (var x = 0; x < 5; x++){
  console.log(btc_ethOrderBook.buy[x]);
}
```
Output:
```
orderListing { Quantity: 1.17983221, Rate: 0.11185 }
orderListing { Quantity: 11.64072243, Rate: 0.1118 }
orderListing { Quantity: 0.12870903, Rate: 0.11173948 }
orderListing { Quantity: 7.152, Rate: 0.11166313 }
orderListing { Quantity: 0.91782434, Rate: 0.11166312 }
```
## Contact
Email me with any questions at jpstratman@unomaha.edu
