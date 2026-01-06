import { useState } from 'react';

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
    isWaiting,
    lang,
    onLangChange
}) {

    const getDisplayQuestion = () => {
        if (typeof question === 'object' && question !== null) {
            return question[lang] || question.en || '';
        }
        return question;
    };

    const getDisplayOption = (option) => {
        if (typeof option === 'object' && option !== null) {
            return option[lang] || option.en || '';
        }
        return option;
    };

    const isLongAnswer = options.some(opt => {
        const text = getDisplayOption(opt);
        return text.length > 8;
    });

    const getButtonClass = (index) => {
        let className = 'option-btn';
        const text = getDisplayOption(options[index]);
        if (text.length > 17) className += ' long-text';

        if (showResult) {
            if (index === correctIndex) {
                className += ' correct';
            } else if (index === selectedAnswer && index !== correctIndex) {
                className += ' wrong';
            }
        } else if (index === selectedAnswer) {
            className += ' selected';
        }
        return className;
    };

    const hasTranslation = typeof question === 'object' && question?.zh;

    return (
        <div className="card question-card animate-fade-in">
            {hasTranslation && (
                <button
                    className="lang-toggle"
                    onClick={() => onLangChange(prev => prev === 'en' ? 'zh' : 'en')}
                    title="Switch Language"
                >
                    {lang === 'en' ? 'zh' : 'en'}
                </button>
            )}
            <div className="question-number">
                Question {questionNumber} of {totalQuestions}
            </div>
            <div className="question-text">
                {getDisplayQuestion()}
            </div>
            <div className={`options-grid ${isLongAnswer ? 'long-options' : ''}`}>
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
                        {getDisplayOption(option)}
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
