func fetchTitle(id: Int) async throws -> String {
    try await Task.sleep(for: .seconds(1))
    return "Title \(id)"
}

@main
struct App {
    static func main() async throws {
        var counter = 0

        async let call1: String = {
            let title = try await fetchTitle(id: 1)
            counter += 1
            return title
        }()

        async let call2: String = {
            let title = try await fetchTitle(id: 2)
            counter += 1
            return title
        }()

        async let call3: String = {
            let title = try await fetchTitle(id: 3)
            counter += 1
            return title
        }()

        let (result1, result2, result3) = try await (call1, call2, call3)
        print(result1, result2, result3)
        print("Counter: \(counter)")
    }
}
