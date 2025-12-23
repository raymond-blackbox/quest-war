function QuestionCard({
    question,
    questionNumber,
    totalQuestions,
    options,
    onAnswer,
    disabled,
    selectedAnswer,
    correctIndex,
    showResult,
    isWaiting
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
            // Show as selected (neutral/pending) until result is revealed
            className += ' selected';
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
                        onClick={(e) => {
                            onAnswer(index);
                            e.currentTarget.blur();
                        }}
                        disabled={disabled}
                    >
                        {option}
                    </button>
                ))}
            </div>
            {isWaiting && (
                <div className="waiting-indicator animate-fade-in">
                    Waiting for others to answer...
                </div>
            )}
        </div>
    );
}

export default QuestionCard;
