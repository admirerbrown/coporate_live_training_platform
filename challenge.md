# nooks-streamdom-challenge

### Submission Instructions

Once you've finished the take home assignment, please zip your code in a .zip and email it to us. Please include any relevant instructions in this README for how to run the app.

Also, make sure to check the boxes in the rubric below before you submit the assignment

### Overview
In this challenge, we want to understand your:

- ability to build something non-trivial from scratch
- comfort picking up unfamiliar technologies
- architectural decisions, abstractions, and rigor

### Problem

Build a product analytics “session streaming” tool that allows product managers (PMs) to watch user sessions. Instead of screensharing (which sends video data and is tedious for users), this tool should work by sending DOM updates. We’ll call our tool StreamDOM

The PM should be able to import & initialize the session streamer by adding a few lines of code:
```
import StreamDOM from './StreamDOM.ts'
StreamDom.init({sessionId: 'SESSION_ID'})
```
Then the PM should be able to watch this session in our StreamDOM tool
![image](https://user-images.githubusercontent.com/39148500/206015415-9c32cdf4-66d7-4921-9fd4-1c31abff6940.png)

### Setup

We strongly recommend you use [rrweb](https://github.com/rrweb-io/rrweb). This library has a `record` function to record DOM events, as well as `rrweb-player` to replay these events. Here is [some documentation](https://github.com/rrweb-io/rrweb/blob/master/docs/recipes/live-mode.md) the library provides, explaining how to do live, real-time replay.

You need to support streaming **previous sessions AND live sessions**. Since you’re streaming sessions in realtime, we’d recommend you **use websockets**. Also, you’ll probably **need a database** to store events from previous sessions - feel free to use something simple like [sqlite](https://sqlite.org/index.html).

### Assumptions

- You might have thousands of sessions per day with lots of data. You’ll probably **need a database** to store events from previous sessions - feel free to use something simple like [sqlite](https://sqlite.org/index.html).
- This tool obviously **doesn’t need to be production-ready**, but you should at least be aware of any issues you may encounter in more real-world scenarios
- Don’t worry about improving the UI of the stream past the rrweb functionality of `record` and `replay` - there will be some limitations of DOM-based screensharing, but this is completely fine for this challenge.
- You should be able to DIY the design (don’t worry too much about it)

### Required Functionality

- [ ] The product manager should be able to see the **list of all current and recent (<1 day old) sessions** (just showing session id’s is fine)
- [ ] The product manager should be able to **watch any active session in real-time**. Or rewind to a previous point in the active session
- [ ] The product manager should be able to **replay any old session**
- [ ] For realtime streaming active sessions, **latency is important! We suggest websockets**
```
Latency of event E = Time E observed by PM - Time of E in user session
```
- [ ] **(Bonus)** Accurately measure the latency and display it for the product manager to see while watching live sessions. For example, display ‘X ms delayed’ while PM is watching the session. Remember that we have no guarantees that clients’ clocks are synchronized
