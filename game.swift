import Foundation

// Функция для получения случайного жеста от компьютера
func getComputerGesture() -> String {
    let gestures = ["Rock", "Paper", "Scissors"]
    return gestures.randomElement()!
}

// Функция, которая принимает два жеста и возвращает победителя
func getWinner(playerGesture: String, computerGesture: String) -> String {

    // Ничья
    if playerGesture == computerGesture {
        return "Ничья!"
    }
    
    // Игрок при выборе камня побеждает, если компьютер выбрал ножницы
    if playerGesture == "Rock" && computerGesture == "Scissors" {
        return "Вы победили!"
    }
    
    // Игрок при выборе ножниц побеждает, если компьютер выбрал бумагу
    if playerGesture == "Scissors" && computerGesture == "Paper" {
        return "Вы победили!"
    }
    
    // Игрок при выборе бумаги побеждает, если компьютер выбрал камень
    if playerGesture == "Paper" && computerGesture == "Rock" {
        return "Вы победили!"
    }
    
    // Если всё иное, компьютер выиграл
    return "Вы проиграли..."
}

// Функция для получения жеста от пользователя
func getPlayerGesture() -> String {
    print("Choose your move: (R)ock, (P)aper, or (S)cissors?")
    
    while true {
        if let playerChoice = readLine(strippingNewline: true) {
            
            // Обработка выбора игрока
            switch playerChoice.lowercased() {
            case "r", "rock":
                return "Rock"
            case "p", "paper":
                return "Paper"
            case "s", "scissors":
                return "Scissors"
            default:
                print("Выберите жест корректно: (R)ock, (P)aper, or (S)cissors?")
            }
        }
    }
}

// Основной цикл игры
while true {
    let playerGesture = getPlayerGesture()
    let computerGesture = getComputerGesture()
    let winner = getWinner(playerGesture: playerGesture, computerGesture: computerGesture)
    print("Вы выбрали \(playerGesture), компьютер выбрал \(computerGesture). \(winner)")
    
    // Запрашиваем у пользователя, хочет ли он играть ещё раз
    print("Сыграем ещё раз? (Y)es or (N)o")
    if let playAgain = readLine(strippingNewline: true)?.lowercased() {
        if playAgain == "n" {
            break
        }
    }
}