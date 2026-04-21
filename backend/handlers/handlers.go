package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jeopardy-game/backend/database"
	"github.com/jeopardy-game/backend/models"
)

// --- Game Endpoints ---

// GetGames returns a list of games
func GetGames(c *gin.Context) {
	var games []models.Game
	database.DB.Order("created_at desc").Find(&games)
	c.JSON(http.StatusOK, games)
}

// GetGame gets full game details (categories & questions)
func GetGame(c *gin.Context) {
	id := c.Param("id")
	var game models.Game

	if err := database.DB.Preload("Categories").Preload("Categories.Questions").First(&game, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Game not found"})
		return
	}

	c.JSON(http.StatusOK, game)
}

// CreateGame creates a new game template with its categories and questions
func CreateGame(c *gin.Context) {
	var game models.Game
	if err := c.ShouldBindJSON(&game); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Create(&game).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, game)
}

// DeleteGame removes a game
func DeleteGame(c *gin.Context) {
	id := c.Param("id")

	// Delete associated play sessions to satisfy foreign key constraints
	database.DB.Where("game_id = ?", id).Delete(&models.PlaySession{})

	// Now delete the game
	if err := database.DB.Delete(&models.Game{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// UpdateGame updates a game's settings, categories, and questions
func UpdateGame(c *gin.Context) {
	id := c.Param("id")

	var existingGame models.Game
	if err := database.DB.Preload("Categories").Preload("Categories.Questions").First(&existingGame, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Game not found"})
		return
	}

	var input models.Game
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Delete old categories and questions (cascade will handle questions)
	for _, cat := range existingGame.Categories {
		database.DB.Where("category_id = ?", cat.ID).Delete(&models.Question{})
	}
	database.DB.Where("game_id = ?", existingGame.ID).Delete(&models.Category{})

	// Update game fields
	existingGame.Title = input.Title
	existingGame.NumCategories = input.NumCategories
	existingGame.QuestionsPerCategory = input.QuestionsPerCategory
	existingGame.BasePointValue = input.BasePointValue
	existingGame.Categories = input.Categories

	// Update Final Jeopardy fields
	existingGame.FinalJeopardyCategory = input.FinalJeopardyCategory
	existingGame.FinalJeopardyClue = input.FinalJeopardyClue
	existingGame.FinalJeopardyAnswer = input.FinalJeopardyAnswer
	existingGame.FinalJeopardyMediaType = input.FinalJeopardyMediaType
	existingGame.FinalJeopardyMediaURL = input.FinalJeopardyMediaURL
	existingGame.FinalJeopardyAnswerMediaType = input.FinalJeopardyAnswerMediaType
	existingGame.FinalJeopardyAnswerMediaURL = input.FinalJeopardyAnswerMediaURL

	// Set the GameID on all new categories
	for i := range existingGame.Categories {
		existingGame.Categories[i].GameID = existingGame.ID
		existingGame.Categories[i].ID = 0
		for j := range existingGame.Categories[i].Questions {
			existingGame.Categories[i].Questions[j].ID = 0
			existingGame.Categories[i].Questions[j].CategoryID = 0
		}
	}

	if err := database.DB.Save(&existingGame).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload to return full data
	database.DB.Preload("Categories").Preload("Categories.Questions").First(&existingGame, existingGame.ID)
	c.JSON(http.StatusOK, existingGame)
}

// --- Session Endpoints ---

// CreateSession creates a gameplay session
func CreateSession(c *gin.Context) {
	var session models.PlaySession
	if err := c.ShouldBindJSON(&session); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Create(&session).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload to get the Game template
	database.DB.Preload("Game").Preload("Game.Categories").Preload("Game.Categories.Questions").Preload("Contestants").Preload("UsedQuestions").First(&session, session.ID)

	c.JSON(http.StatusCreated, session)
}

// GetSession returns a session with all its state
func GetSession(c *gin.Context) {
	id := c.Param("id")
	var session models.PlaySession

	if err := database.DB.Preload("Game").Preload("Game.Categories").Preload("Game.Categories.Questions").Preload("Contestants").Preload("UsedQuestions").First(&session, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}

	c.JSON(http.StatusOK, session)
}

// UpdateScore modifies a contestant's score
func UpdateScore(c *gin.Context) {
	sessionID := c.Param("id")
	contestantID := c.Param("cid")

	var input struct {
		ScoreDelta int `json:"score_delta"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var contestant models.Contestant
	if err := database.DB.Where("id = ? AND play_session_id = ?", contestantID, sessionID).First(&contestant).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contestant not found"})
		return
	}

	contestant.Score += input.ScoreDelta
	database.DB.Save(&contestant)

	c.JSON(http.StatusOK, contestant)
}

// MarkQuestion marks a question as used in a session
func MarkQuestion(c *gin.Context) {
	sessionID := c.Param("id")
	var input struct {
		QuestionID uint `json:"question_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sessionIDInt, _ := strconv.Atoi(sessionID)
	usedQuestion := models.UsedQuestion{
		PlaySessionID: uint(sessionIDInt),
		QuestionID:    input.QuestionID,
	}

	if err := database.DB.Create(&usedQuestion).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, usedQuestion)
}
