package models

import (
	"time"
)

type Game struct {
	ID                   uint       `json:"id" gorm:"primaryKey"`
	Title                string     `json:"title"`
	NumCategories        int        `json:"num_categories"`
	QuestionsPerCategory int        `json:"questions_per_category"`
	BasePointValue       int        `json:"base_point_value"`
	Categories           []Category `json:"categories" gorm:"constraint:OnDelete:CASCADE;"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`

	// Final Jeopardy
	FinalJeopardyCategory        string `json:"final_jeopardy_category"`
	FinalJeopardyClue            string `json:"final_jeopardy_clue"`
	FinalJeopardyAnswer          string `json:"final_jeopardy_answer"`
	FinalJeopardyMediaType       string `json:"final_jeopardy_media_type"`       // none, image, audio, video
	FinalJeopardyMediaURL        string `json:"final_jeopardy_media_url"`
	FinalJeopardyAnswerMediaType string `json:"final_jeopardy_answer_media_type"` // none, image, video
	FinalJeopardyAnswerMediaURL  string `json:"final_jeopardy_answer_media_url"`
}

type Category struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	GameID    uint       `json:"game_id"`
	Name      string     `json:"name"`
	Position  int        `json:"position"`
	Questions []Question `json:"questions" gorm:"constraint:OnDelete:CASCADE;"`
}

type Question struct {
	ID              uint   `json:"id" gorm:"primaryKey"`
	CategoryID      uint   `json:"category_id"`
	Tier            int    `json:"tier"` // Row index (0, 1, 2...)
	PointValue      int    `json:"point_value"`
	Clue            string `json:"clue"`
	MediaType       string `json:"media_type"` // none, image, audio, video
	MediaURL        string `json:"media_url"`
	Options         string `json:"options"` // JSON array of multiple choice options, e.g. '["A","B","C"]'
	Answer          string `json:"answer"`
	AnswerMediaType string `json:"answer_media_type"` // none, image, video
	AnswerMediaURL  string `json:"answer_media_url"`
}

type PlaySession struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	GameID        uint           `json:"game_id"`
	Game          Game           `json:"game" gorm:"foreignKey:GameID"`
	Contestants   []Contestant   `json:"contestants" gorm:"constraint:OnDelete:CASCADE;"`
	UsedQuestions []UsedQuestion `json:"used_questions" gorm:"constraint:OnDelete:CASCADE;"`
	CreatedAt     time.Time      `json:"created_at"`
}

type Contestant struct {
	ID            uint   `json:"id" gorm:"primaryKey"`
	PlaySessionID uint   `json:"play_session_id"`
	Name          string `json:"name"`
	Score         int    `json:"score"`
}

type UsedQuestion struct {
	ID            uint `json:"id" gorm:"primaryKey"`
	PlaySessionID uint `json:"play_session_id"`
	QuestionID    uint `json:"question_id"`
}
