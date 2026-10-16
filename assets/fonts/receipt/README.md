# Receipt fonts

Unmodified official static fonts from `notofonts/noto-fonts`, pinned commit
`ffebf8c1ee449e544955a7e813c54f9b73848eac`.
Source: https://github.com/notofonts/noto-fonts/tree/ffebf8c1ee449e544955a7e813c54f9b73848eac/hinted/ttf

NotoSansThai Regular/Bold supply Thai glyphs/shaping. Static Thai files lack Latin,
so NotoSans Regular/Bold from the same source supply Latin/numbers/punctuation.
Both use the bundled unmodified OFL.txt. No runtime download. Next standalone
explicitly traces this directory for the receipt route. No patient data in assets.

SHA-256:

- NotoSansThai-Regular.ttf: `404ddfb5ed0aaa6b6ec8a85700d682978992062d67da93903967b56cbd9a4acc`
- NotoSansThai-Bold.ttf: `2b67cfb22337a868c6c85709e648ea30c79e0a7c530a5fc169a73d3f461d7c52`
- NotoSans-Regular.ttf: `b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5`
- NotoSans-Bold.ttf: `c976e4b1b99edc88775377fcc21692ca4bfa46b6d6ca6522bfda505b28ff9d6a`
- OFL.txt: `0dab92d0544f7b233403f14b84a663bdbfa746982eda629e7f4f9ffe1b036feb`

`features/consultations/receipt/font-coverage.ts` is the union of each regular
font's `characterSet` from PDFKit's locked fontkit dependency, choosing Thai font
only for U+0E00-0E7F and Latin otherwise, compressed into inclusive intervals.
Controls, replacement characters and noncharacters are excluded. Regenerate/review
coverage and render tests whenever fonts change. Unsupported account-name glyphs
(e.g. emoji/CJK) withhold the receipt rather than silently substituting squares.
