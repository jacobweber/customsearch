# Custom Search

Custom searches in a popup window.

![logo](https://raw.githubusercontent.com/jacobweber/customsearch/master/sample.png)

Press a key to open the search window.

While open, you can type text to search, or press:
* tab or shift-tab to select a search type
* ↑ or ↓ to select a result
* enter to open selected result
* ctrl+c to copy selected result
* esc to close

You can write your own search types in JavaScript, that work with any API. Open Preferences, and click Open next to Search Types. The README.txt file has details, or you can follow the built-in examples.

To build apps for Mac, Windows, and Linux, run:

```
npm install
npm run dist
```