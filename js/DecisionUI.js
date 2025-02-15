class DecisionUI {
    constructor(game) {
        this.game = game;
        this.decisionForm = document.getElementById('decision-form');
        this.optionsForm = document.getElementById('options-form');
        this.resultOverlay = document.getElementById('result');
        this.chosenOption = document.getElementById('chosen-option');
        this.playAgainButton = document.getElementById('play-again');
        
        this.init();
    }
    
    init() {
        // Handle form submission
        this.optionsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const option1 = document.getElementById('option1').value;
            const option2 = document.getElementById('option2').value;
            
            this.decisionForm.classList.add('hidden');
            this.game.start(option1, option2);
        });
        
        // Handle play again button
        this.playAgainButton.addEventListener('click', () => {
            this.resultOverlay.classList.add('hidden');
            this.decisionForm.classList.remove('hidden');
            this.optionsForm.reset();
        });
    }
    
    showResult(option) {
        this.chosenOption.textContent = `The choice is: ${option}`;
        this.resultOverlay.classList.remove('hidden');
    }
} 