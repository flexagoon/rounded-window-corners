# `utils`

This directory contains functions which are used in different places throughout
the codebase, so they can't be put anywhere else.

## `box_shadow.ts`

Contains a function for converting box shadow JS objects into CSS styles for
those shadows.

## `constants.ts`

Defines the constants used in the codebase.

## `file.ts`

Contains utility functions for reading file contents.

## `log.ts`

Provides wrapper functions for printing out debug messages.

## `settings.ts`

Provides wrappers around the GSettings object that add type safety and
automatically convert values between JS types and GLib Variant types that are
used for storing GSettings.

## `types.ts`

Provides types used throughout the codebase, mostly for storing settings. 
