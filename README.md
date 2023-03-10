---
Type: Qlik Sense Visualization Extension
Name: E-mergo App Mixer
Version: 1.0-alpha
QEXT: qs-emergo-app-mixer.qext
---

# E-mergo App Mixer

**E-mergo App Mixer** is a Qlik Sense visualization extension created by [E-mergo](https://www.e-mergo.nl). This extension enables the dashboard designer to embed visualizations from other apps.

This extension is part of the [E-mergo Tools bundle](https://www.e-mergo.nl/e-mergo-tools-bundle).

This extension is [hosted on GitHub](https://github.com/e-mergo/qs-emergo-app-mixer). You can report bugs and discuss features on the [issues page](https://github.com/e-mergo/qs-emergo-app-mixer/issues).

## Why is this extension needed?
The demand for aggregation of KPI's from across the Qlik Sense environment grows when adaptation of the platform increases. Such meta-dashboards would usually contain visualizations and data that may be totally unrelated. One solution would be to create a new datamodel containing uncommon data associations or lots of data islands. This however means recreating the logic from different apps, resulting in redundant development.

This extension leaves the underlying logic of each KPI at its origin and only presents the visualized data. Using the native Qlik Sense embedding functionality, the extension enables the dashboard designer to embed any visualization from any app from across the Qlik Sense environment. When enabling the Link to Sheet setting, the user of the app may then navigate to the original app and continue their data analysis.

## Disclaimer
This extension is created free of charge for Qlik Sense app developers, personal or professional. E-mergo developers aim to maintain the functionality of this extension with each new release of Qlik Sense. However, this product does not ship with any warranty of support. If you require any updates to the extension or would like to request additional features, please inquire for E-mergo's commercial plans for supporting your extension needs at support@e-mergo.nl.

On server installations that do not already have it registered, the Markdown file mime type will be registered when opening the documentation page. This is required for Qlik Sense to be able to successfully return `.md` files when those are requested from the Qlik Sense web server. Note that registering the file mime type is only required once and is usually only allowed for accounts with RootAdmin level permissions.

## Features
Below is a detailed description of the available features of this extension.

### Select Visualization
To start selecting the visualization first select the app origin. The app selector popover enables searching based on app name. In the opened modal navigate to the desired sheet. Selecting a visualization in the sheet highlights the object. Confirm the dialog to make the selection permanent.

### Configuration
A variety of settings can be changed to alter the appearance and interaction of the embedded visualization.

#### Allow interaction
Enables basic interaction in the visualization, like scrolling and pop-ups.

#### Allow selections
Enables selection of dimensions within the visualization.

#### Enable context menu
Enables the context menu for the visualization, which usually contains export options.

#### Language
Sets the language for the visualization's interface.

#### Theme
Sets the theme for the visualization.

#### Show Selections Bar
Displays the selections bar for the visualization.

#### Clear Selections
Clears the selections in the user's session for the visualization.

#### Apply bookmark
Applies the selected bookmark in the user's session for the visualization.

### Link to Sheet
Enables navigation to the visualization's original app sheet. Similar to the functionality in the KPI object, the user activates the link in two clicks - only when selections are not allowed. The navigation link is also available in the visualization's context menu, which is made easier to access as of QS Sept 2020.

## FAQ

### How does this extension compare to PinIt from Bitmetric?
The PinIt application was launched by Bitmetric as a Qlik Sense tool that lives outside of the Qlik Sense hub. It provides a way of integrating visualizations from multiple apps into a single page, like this extension does. The key differences are:
- Availibility to end users. The PinIt tool can be used by all end users within the license agreement, while this extension is only available for Qlik Sense users that can create and edit sheets (with a Professional license).
- Cost. Beyond the first five users, the PinIt tool costs you money. This extension however is free and open source, regardless of the amount of users.
- Installation. The PinIt tool is a separate application from Qlik Sense, while this extension is an extension like any other: quick and easy to distribute and use.
- Features. This extension allows for per-visualization settings like allowing selections, changing language and theme, as well as applying bookmarks.
- Context. Designing a summary page in the PinIt tool is limited to the features within that application, while this extension is part of the Qlik Sense sheet design workflow you already know and trust.

### Can I get support for this extension?
E-mergo provides paid support through standard support contracts. For other scenarios, you can post your bugs or questions in the extension's GitHub repository.

### Can you add feature X?
Requests for additional features can be posted in the extension's GitHub repository. Depending on your own code samples and the availability of E-mergo developers your request may be considered and included.

## Changelog

#### 1.0-alpha - QS Nov 2022
- Public release.

#### 0.2.20200918 - QS Sept 2020
- Added link-to-sheet navigation in the object's context menu.
- Fixed addition of 'noselections' in the iframe's url.
- Fixed selectability of the extension object in edit mode.

#### 0.1.20200731
Initial release.
