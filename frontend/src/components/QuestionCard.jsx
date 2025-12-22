function QuestionCard({
    question,
    questionNumber,
    totalQuestions,
    options,
    onAnswer,
    disabled,
    selectedAnswer,
    correctIndex,
    showResult
}) {
    const getButtonClass = (index) => {
        let className = 'option-btn';
        if (showResult) {
            if (index === correctIndex) {
                className += ' correct';
            } else if (index === selectedAnswer && index !== correctIndex) {
                className += ' wrong';
            }
        } else if (index === selectedAnswer) {
            // Round still active but this player answered
            // In our logic, if round is active and they answered, it must be wrong
            className += ' wrong';
        }
        return className;
    };

    return (
        <div className="card question-card animate-fade-in">
            <div className="question-number">
                Question {questionNumber} of {totalQuestions}
            </div>
            <div className="question-text">
                {question}
            </div>
            <div className="options-grid">
                {options.map((option, index) => (
                    <button
                        key={index}
                        className={getButtonClass(index)}
                        onClick={() => onAnswer(index)}
                        disabled={disabled}
                    >
                        {option}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default QuestionCard;
