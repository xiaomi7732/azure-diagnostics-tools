# The call tree filter

![Introduction](./media/intro_v2.gif)

## Why the filter

CallTree exposes a lot of performance information, sometimes, it is too much. We introduced a call tree filter to reduce the noise.

With the ability to filter out stacks on the call tree, it will be easier to focus onto modules that are interesting.

## Basic usage

### Hide a module

Click the **&#x2B59;** sign right to the module name to hide the specific module. This is an easy way to hide events for modules that are out of scope.

_Tips: notice the `!` sign at the end of the module name._

### Use suggested hidings

Try the `Suggested` button. It will add the filters to hide most of the framework events from the call tree.

### Entering your own strings to hide even more

Click 'Hide More' first to bring up the text box. In the text box, typing in the strings for filter and press **Enter** or use the `Hide` button to hide them.

_Tips: Try to hide more than one string separate by semicolon like `Microsoft;System`._

### Bring back hidden events

To remove a string from the list of hidden events, use the **&#x2573;** button to the right of the strings in the list.

## The filter's characteristic

* It hides the stack that matches;
* It is case sensitive;
* It is partial string match;

## Caveats

Despite the characteristics of the filters, you might notice it not working as expected. There are several caveats that might become interesting.

### Ancestors might be filtered

It might filter out ancestors for the interested node. Expand the tree so that the information is loaded before applying a filter on it.

### It might not match what you see

Under the hood, the filter matches the raw label rather than the polished display text. For example, `CPU_TIME` is displayed as `CPU Time`, but the filter will still only match `CPU_TIME`.

To find out the raw label, hover the mouse over the text:

![Tooltip showing raw text](./media/tooltips.png)

## Moving forward

We are looking into providing better suggestion of filters as well as better ways to add/remove filters. Please feel free to [open issues on the GitHub](https://github.com/Azure/azure-diagnostics-tools/issues) if there's suggestions for the filters.
