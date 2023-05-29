# Micro Plum
![](https://img.shields.io/github/license/LibreService/micro_plum)

Recipe downloader for [My RIME](https://github.com/LibreService/my_rime).

It's designed to fit [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) restrictions.
In short,
there is no free way to clone a GitHub repo to browser,
and you can only download a single file when you know the URL of it
(using raw.githubusercontent.com or cdn.jsdelivr.net).

## Comparison with [plum](https://github.com/rime/plum)
-|plum|Micro Plum
-|-|-
Type|command line tool|JavaScript library
Method|git clone|download 🔁 parse
Parameter|repository|*repository and schema Ids, or schema URL
recipe.yaml|support|**no support
Maintainability|bash 😢 + bat 😭|TypeScript 😄

\* Using plum you still need to assign schema Ids on deploy.
Being able use a single URL of schema mitigates the inconvenience to some extent.

\*\* Due to CORS, it can't expand wildcard.

## License
LGPLv3+
in order to be compatible with plum
