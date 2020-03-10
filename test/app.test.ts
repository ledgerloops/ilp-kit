import { makeHandler } from "../src/app";

describe("App", function() {
  it("has a makeHandler method", function() {
    expect(typeof makeHandler).toEqual("function");
  });
});
