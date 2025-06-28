
# CartoSVG Project Analysis

## Overview

This project is a web-based SVG map designer called CartoSVG. It allows users to create and customize Scalable Vector Graphics (SVG) maps with various features, including different map projections, layers, and data visualizations. The application is built using Svelte for the frontend, and it leverages several libraries for mapping and geometry operations, such as D3.js, MapLibre GL, and Turf.js.

It also uses the `InlineStyleEditor` library, which is a tool that enables direct CSS rules change using a small graphical interface. It can be opened on a given element, and some of this element's style can be changed dynamically (colors, stroke width...)

The main goal of the application is to create intuitively static SVG maps that can be exported to the user and included directly into a website (by pasting the exported SVG in an HTML page). It is different of the existing solutions by a few aspects:
- Simple usage of the final map: simply paste the SVG, no need to load any Javascript, technical knowledge not required
- The map is customizable to be stylish, in addition to being practical (showing data)
- The exported SVG is as small as possible, by using different optimization techniques

There are globally two main modes for the application:
- "macro" mode, to create maps at the scale of countries or continents (or whole world)
- "micro" mode, to create maps with more details (to see a city with buildings, streets, etc)

There is also common code for the two modes (in `App.svelte`). This common code will use micro and macro modes, and add common features to it. See the "Common features" section.

## Project Structure

The project is organized into several directories, each with a specific purpose:

- **`.github`**: Contains GitHub Actions workflows, such as the one for checking GeoBoundaries releases.
- **`dist`**: This directory holds the built and bundled assets for the application, which are ready for deployment.
- **`node_modules`**: This directory contains all the project's dependencies.
- **`release-versions`**: This directory contains a text file with the latest version of GeoBoundaries.
- **`src`**: This is the main source code directory for the Svelte application.
  - **`assets`**: This directory contains static assets like images, styles, and data.
  - **`components`**: This directory contains reusable Svelte components that are used throughout the application.
  - **`examples`**: This directory contains example projects that can be loaded into the application.
  - **`macro`**: This directory contains code related to the "macro" view of the map.
  - **`micro`**: This directory contains code related to the "micro" view of the map.
  - **`shared`**: This directory contains shared code that is used by both the "macro" and "micro" views.
  - **`svg`**: This directory contains code for generating and manipulating SVGs.
  - **`util`**: This directory contains utility functions that are used throughout the application.
- **`test`**: This directory contains experimental test files, to ignore.

## Key Technologies

- **Svelte**: A modern JavaScript compiler that allows you to write easy-to-understand JavaScript code that is then compiled to highly efficient, imperative code that runs in the browser.
- **D3.js**: A JavaScript library for producing dynamic, interactive data visualizations in web browsers.
- **MapLibre GL**: A free and open-source library for client-side vector-based maps.
- **Turf.js**: A JavaScript library for spatial analysis.
- **Vite**: A build tool that provides a faster and leaner development experience for modern web projects.
- **TypeScript**: A typed superset of JavaScript that compiles to plain JavaScript.


## Macro mode
This is the most complex of the 2 modes. The main logic is contained in `MacroSidebar.svelte`.
It allows rich customization of a view of the world. The geometry data of the world is from the GeoBoundaries repository, which is preprocessed by the `getAndSimplifyWorld.ts` script, and the output of that script is stored inside `src/assets/layers`. This folder contains topojson files:
- `world_land_very_simplified.topojson`: This is a very simplified version of the whole land, used when the user drags the map, for fast rendering
- `world_adm0_simplified.topojson`, which contains geometries for all the countries in the world
- `adm1` folder contains all ADM1 (region) geometries for all the countries of the world (if it exists for this country)
- `adm2` folder contains all ADM2 (more detailed regions than ADM1) geometries for all the countries of the world (if it exists for this country)

The macro mode features multiple projections: "classical" projections, provided by d3, and "satellite" projection, which is more complex, but allows to have a globe projection with variable altitude, tilt and rotation.

The user is allowed to zoom and drag the map to change the projection and move around the world (in `src/macro/interactions.ts`).

Multiple parameters are available to the user to customize the map. The parameters are separated into two tabs inside a sidebar:

### General tab
Contains parameters to customize visually the map: change the width / height of the container, the sea color, the graticule, the border, etc. It also allow to change "glow" parameters, which are custom SVG filters that allows the element on which it is applied to have a glow effect (inner and outer).

### Layers tabs
In this tab, the user is able to decide which layers will be displayed on the map: will it show "lands" (which are all land masses in the world), will it show the countries boundaries. 
The user can here add new adm data for countries. For instance it can chose to add ADM2 data for France.
For the "land" tab and the ADM tab, the user can chose which "glow filter" to use, that are defined in the general tab. This allows for a nice effect on the map.
For each layer (expect land, which is just visual and has no data), the user can bind data to the layer.
With the data that is bound, the user can show a tooltip when a region is hovered, and colorize the map according to the data.

#### Tooltips
If the user enables tooltip for a layer, a tooltip will display when a region of this layer is hovered. The logic is handled in `src/tooltip.ts`. What is displayed in the tooltip will depend on what is in a dedicated template (inside `macroState.tooltipDefs.<layer>.template`). This template is using HTML, and a variable name in the data bound to the layer between brackets means to display this variable (for instance ` <span> Country: {name}</span>` will display `Country: France` when France is hovered). The template is editable for the user.

Using `InlineStyleEditor`, the user can edit the template style by clicking on a tooltip example in the sidebar. The style changes will be stored (in `macroState.tooltipDefs.<layer>.content` and applied on the actual tooltip on hover).


#### Layer coloring
With the data bounds to a layer, the user can chose to colorize the layer according to a field of the data. There are 2 mains modes for coloring:
- "categorical", is the data field contains strings
- "numerical" (quantize and quantile) if the data field contains numbers 

Then the user can chose to display a legend with various options to customize how it is displayed.


## Micro mode

This mode allows for the creation of detailed maps of smaller areas, such as cities. The main logic for this mode is contained in the `src/detailed.ts` file. This mode uses MapLibre GL to render a map with vector tiles from MapTiler. The user can then select which layers to display on the map, and customize their appearance.

The `drawPrettyMap` function in `src/detailed.ts` is responsible for rendering the map. It fetches the vector tile data from MapTiler, and then it uses D3.js to render the data as SVG paths. The user can customize the appearance of the different layers by changing their color, stroke width, and other properties.

The user can also add custom data to the map, and use it to color the different features. The `onMicroParamChange` function is responsible for handling changes to the parameters, and it will update the CSS rules for the different layers accordingly.

Finally, the `exportMicro` function is responsible for exporting the map as an SVG file. It uses the SVGO library to optimize the SVG, and it also gives the user the option to embed the fonts in the SVG file or to convert the text to paths.

## Common features
Some common features exist between the two modes, which are handle in `App.svelte`. The main drawing function is the `draw` function in `App.svelte`, which will call all drawing functions (macro or micro + common drawing). 
By right-clicking on the map, a menu opens, allowing the user to:
- Draw / edit SVG <path> elements (see `src/svg/freeHandPath.ts` and `src/svg/pathEditor.ts`)
- Draw freehand on the map (`src/svg/freeHandDraw.svg`)
- Add labels on the map. It is possible to provide a font to the app, and use it using `InlineStyleEditor`. On export, we will give the choice to the user to embed or not the font as base64 in the final SVG, convert the `<label>` elements to `<path>` using `text-to-svg`, or the smallest file size of the 2 possibilities
- Add icons on the map (points / square and more)

The saving is also common of the two modes. The state of the application is periodically serialized to `localStorage`. The state is global in `state.svelte.ts` and use throughout the app.