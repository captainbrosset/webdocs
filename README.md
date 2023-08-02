# A little web docs playground

To generate the data:

1. `npm run get-mdn-content`
1. `npm run extract-mdn-data`
1. `npm run convert-to-html`
1. `npm run expand-macros`
1. `npm run post-process-html`

Now the `/docs` directory contains HTML files for the docs.

You can run `npm run cleanup` optionally to remove the cloned mdn-content repo.

Test deploy: https://captainbrosset.github.io/webdocs/
