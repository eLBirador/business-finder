# Business Finder

**An animated map for your business website that shows visitors exactly where you are.**

> Working title. This is an early concept by Yahaay IT Consultancy: nothing is built yet.

## The idea

When someone opens your page, the map plays a short, smooth animation:

1. It starts with a wide view of the city (e.g. Sydney).
2. It zooms in to your suburb (e.g. Thornleigh).
3. It lands on your exact location, with a marker.

It's a friendly, memorable way to say "here's where to find us".

## How it works

- You paste a short piece of embed code into your website.
- The code includes your latitude and longitude.
- When the page loads, the map works out the city and suburb views from those coordinates and plays the animation automatically.
- Afterwards the map stays on your location, so visitors can look around or get directions.

No map skills needed: just your coordinates.

## Example embed code

The URL and coordinates below are placeholders (roughly Thornleigh) and the final format is still to be decided.

Script tag:

```html
<script src="https://embed.example.com/business-finder.js"></script>
<div class="business-finder"
     data-lat="-33.7290"
     data-lng="151.0790"
     data-name="Your Business Name">
</div>
```

Iframe:

```html
<iframe src="https://embed.example.com/finder?lat=-33.7290&lng=151.0790&name=Your%20Business"
        width="100%" height="400" style="border:0"></iframe>
```

| Parameter | Required | What it does |
|---|---|---|
| `lat` / `lng` | Yes | Your business's exact location |
| `name` | No | Label shown on the marker |

Possible extras later: starting city view, marker colour, animation speed and a "Get directions" button.

## Who it's for

Local businesses and organisations in Thornleigh, Hornsby Shire and nearby northern Sydney, such as:

- Shops, cafes, trades and other small local businesses
- Clubs, community groups and venues
- Events and markets
- Real estate agents
- Tourism and visitor spots

## Still to decide

- [ ] Pricing (one-off setup, monthly, or both)
- [ ] Tech stack (map library and tile provider)
- [ ] Hosting for the embed script
- [ ] Branding and final product name
- [ ] Final embed code format (script tag, iframe, or both)
- [ ] A demo page to show local businesses
