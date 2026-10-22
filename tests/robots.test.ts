import test from "node:test";
import assert from "node:assert/strict";
import { robotsAllows } from "../lib/robots";
test("Shopify wildcards allow public collections while blocking private and filtered routes", () => {
  const policy = `User-agent: *
Allow: /
Disallow: /*/checkout
Disallow: /account
Allow: /account/login
Disallow: /collections/*sort_by*
Disallow: /collections/*+*
Disallow: /*/collections/*+*
Disallow: /*?*preview_theme_id=*
User-agent: adsbot-google
Disallow: /collections/`;
  for (const path of ["/collections/luxe-collection/LUXE-COLLECTION", "/products/dress", "/account/login"])
    assert.equal(robotsAllows(policy, new URL(path, "https://beautboutique.co.uk")), true, path);
  for (const path of ["/en/checkout", "/account", "/collections/luxe?sort_by=price", "/collections/a+b", "/en/collections/a+b", "/?preview_theme_id=1"])
    assert.equal(robotsAllows(policy, new URL(path, "https://beautboutique.co.uk")), false, path);
});
test("specific agent groups, longest match, allow ties and end anchors", () => {
  const policy = `User-agent: *
Disallow: /
User-agent: ElementorStudio
User-agent: OtherBot
Disallow: /private
Allow: /private/public
Disallow: /exact$
Disallow: /tie
Allow: /tie`;
  for (const path of ["/", "/private/public/a", "/exactly", "/tie"])
    assert.equal(robotsAllows(policy, new URL(path, "https://example.org")), true);
  for (const path of ["/private/a", "/exact"])
    assert.equal(robotsAllows(policy, new URL(path, "https://example.org")), false);
});
