# Logistics Optimizer Explained

An interactive, responsive walkthrough of **Intelligent Logistics & Vehicle Routing Optimizer 2.0**
(B.Tech CSE major project). It explains the workflow step by step and lets you try four simplified demos:

1. Dijkstra shortest path (step through it)
2. Nearest-neighbour vs exact bitmask DP route order, with a brute-force check
3. Vehicle capacity check (weight and volume)
4. Travel time changing the best road

The main project lives at <https://github.com/Nishant-tiwari29/major-project>.

## Run locally

It is a plain static site (HTML, CSS, JavaScript, no build step):

```
python -m http.server 8080
```

Then open http://localhost:8080.

## Deploy on Render

`render.yaml` defines a static site. In Render choose **New > Blueprint** (or **New > Static Site**),
connect this repository, publish directory `.`, no build command.

## Team

Nishant Tiwari (6605586), Nisha Kumari (6605603), Jiya Naz (6606445). Guide: Aarshi Gupta.

License: MIT
