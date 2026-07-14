func fetchTitle(id: Int) async throws -> String {
    try await Task.sleep(for: .seconds(1))
    return "Title \(id)"
}

@main
struct App {
    static func main() async throws {
        // Dynamic count — in real code this might come from an API response,
        // a database query, whatever. async let can't handle "unknown at compile time."
        let ids = Array(1...10)

        let start = ContinuousClock.now

        // withThrowingTaskGroup instead of withTaskGroup because fetchTitle can throw.
        // of: String.self — each child task returns a String (the title).
        let titles = try await withThrowingTaskGroup(of: String.self) { group in
            // Spawn one child task per id — this loop is the "dynamic" part
            // async let could never do this, since it has no loop.
            for id in ids {
                group.addTask {
                    try await fetchTitle(id: id)
                }
            }

            // The group itself is an AsyncSequence — you iterate it to pull
            // results out as each child task finishes (NOT in spawn order,
            // in *completion* order).
            var results: [String] = []
            for try await title in group {
                results.append(title)
            }
            return results
        }

        let end = ContinuousClock.now

        print(titles)
        print("Elapsed: \(start.duration(to: end))")
    }
}
