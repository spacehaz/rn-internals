import { jsStartTime, reportStartupMetric } from "./performance";

describe("performance", () => {
  it("captures jsStartTime as a valid epoch timestamp", () => {
    expect(typeof jsStartTime).toBe("number");
    expect(jsStartTime).toBeGreaterThan(0);
  });

  it("reportStartupMetric logs the name and duration formatted to 1 decimal place", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    reportStartupMetric("js-start-to-first-render", 269.03);

    expect(logSpy).toHaveBeenCalledWith("[startup] js-start-to-first-render: 269.0ms");

    logSpy.mockRestore();
  });
});
