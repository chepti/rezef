import { unfurl } from "../src/lib/unfurl";
unfurl("https://openstuff.co.il/21640/").then(r => console.log(JSON.stringify(r, null, 1)));
