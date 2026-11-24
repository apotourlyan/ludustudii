# 0045. UI text inline, in sentence case

- Status: Accepted
- Date: 2026-11-24
- Tags: front-end, ux

## Context

The client app's labels, titles and messages are written in the components
that show them ("Add Card", "Learning Cards"), except text that varies with
state or is shared, which lives in the module's `model/` (the card form's
labels per mode, error wording; [0038](0038-form-validation-errors.md)).
Two questions keep coming back: whether to extract all text into constants or
message catalogs, and which capitalization to use. The app mixes Title Case in
buttons and headings with sentence case in messages.

The application is in English, for one user. No other language is planned.

## Decision

- **UI text stays where it's shown.** A label, title or message is a string
  in the component that renders it. Text moves to `model/` only when it
  varies with state or more than one component needs it, as today.
- **No i18n library and no text constants for their own sake.** If another
  language is ever needed, that is a new decision, made with a library that
  extracts messages from the components (such as Lingui), not by hand.
- **Sentence case everywhere**: headings, buttons, links, labels, toasts and
  accessible names. "Add card", "Learning cards", "Update card". Proper nouns
  keep their capitals.

## Alternatives considered

- **All text in constants per module.** One place per module for wording,
  but every string becomes a lookup, the markup no longer shows what users
  read, and nothing is gained without translation.
- **An i18n library now.** Ready for a second language, but extraction,
  catalogs and a build step for a language nobody needs.
- **Title Case for buttons and headings.** Common in older interfaces, but
  harder to apply consistently (which words are capitalized), and it differs
  from the messages, which are sentences.

## Consequences

- Reading a component shows the text its users see.
- Text that changes is changed where it's shown; tests that find elements by
  their text change with it.
- Adding a language later means extracting every string at once, with a
  library's tooling.
