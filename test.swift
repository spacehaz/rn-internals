func fetchTitle(id: Int) async throws -> String {
    try await Task.sleep(for: .seconds(1))
    return "Title \(id)"
}

@main
struct App {
    static func main() async throws {
        Task {
            // let start = ContinuousClock.now

            // let call1 = try await fetchTitle(id: 1)
            // let call2 = try await fetchTitle(id: 2)
            // let call3 = try await fetchTitle(id: 3)

            // let end = ContinuousClock.now

            // print(call1)
            // print(call2)
            // print(call3)
            // print("Elapsed: \(start.duration(to: end))")

            let start = ContinuousClock.now
            async let call1 = fetchTitle(id: 1)
            async let call2 = fetchTitle(id: 2)
            async let call3 = fetchTitle(id: 3)
            let (result1, result2, result3) = try await (call1, call2, call3)
            print(result1)
            print(result2)
            print(result3)
            let end = ContinuousClock.now
            print("Elapsed: \(start.duration(to: end))")
        }

        // keep main alive long enough for the Task to finish
        try await Task.sleep(for: .seconds(4))
    }
}