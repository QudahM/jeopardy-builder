// Integration Tests for Jeopardy Backend API
//
// PREREQUISITES:
//   These tests require a running PostgreSQL instance with a "jeopardy_test" database.
//   If you're using Docker Compose, run:
//
//     docker compose up -d db
//     docker compose exec db psql -U jeopardy_user -d jeopardy_db -c "CREATE DATABASE jeopardy_test;"
//
//   Then run the tests:
//
//     cd backend
//     DB_HOST=localhost DB_USER=jeopardy_user DB_PASSWORD=jeopardy_password DB_NAME=jeopardy_test DB_PORT=5432 go test -v -count=1
//
//   The tests use the jeopardy_test database so they don't affect your development data.
//   Tables are auto-migrated and cleaned between test groups.

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jeopardy-game/backend/database"
	"github.com/jeopardy-game/backend/handlers"
	"github.com/jeopardy-game/backend/models"
)

// setupTestRouter creates a Gin router identical to the production one
// but connected to the test database.
func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)

	// Connect to the test database using environment variables
	database.ConnectDB()

	r := gin.Default()

	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	r.Use(cors.New(config))

	api := r.Group("/api")
	{
		api.GET("/games", handlers.GetGames)
		api.POST("/games", handlers.CreateGame)
		api.GET("/games/:id", handlers.GetGame)
		api.DELETE("/games/:id", handlers.DeleteGame)
		api.PUT("/games/:id", handlers.UpdateGame)

		api.POST("/sessions", handlers.CreateSession)
		api.GET("/sessions/:id", handlers.GetSession)
		api.PATCH("/sessions/:id/contestants/:cid/score", handlers.UpdateScore)
		api.POST("/sessions/:id/mark_question", handlers.MarkQuestion)

		api.POST("/upload", handlers.UploadMedia)
	}

	r.Static("/uploads", "./uploads")

	return r
}

// cleanDB truncates all tables between test groups
func cleanDB() {
	database.DB.Exec("DELETE FROM used_questions")
	database.DB.Exec("DELETE FROM contestants")
	database.DB.Exec("DELETE FROM play_sessions")
	database.DB.Exec("DELETE FROM questions")
	database.DB.Exec("DELETE FROM categories")
	database.DB.Exec("DELETE FROM games")
}

// jsonRequest is a helper to make JSON API calls and return the response
func jsonRequest(router *gin.Engine, method, path string, body interface{}) *httptest.ResponseRecorder {
	var reqBody io.Reader
	if body != nil {
		jsonBytes, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(jsonBytes)
	}
	req, _ := http.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// parseJSON unmarshals the response body into target
func parseJSON(w *httptest.ResponseRecorder, target interface{}) {
	json.Unmarshal(w.Body.Bytes(), target)
}

// --- Test Helpers ---

// makeTestGame returns a game payload with the given number of categories and questions
func makeTestGame(title string, numCat, numQ, baseValue int) map[string]interface{} {
	categories := make([]map[string]interface{}, numCat)
	for i := 0; i < numCat; i++ {
		questions := make([]map[string]interface{}, numQ)
		for j := 0; j < numQ; j++ {
			questions[j] = map[string]interface{}{
				"tier":        j,
				"point_value": (j + 1) * baseValue,
				"clue":        fmt.Sprintf("Clue for Cat%d Q%d", i+1, j+1),
				"media_type":  "none",
				"media_url":   "",
				"options":     "",
				"answer":      fmt.Sprintf("Answer for Cat%d Q%d", i+1, j+1),
			}
		}
		categories[i] = map[string]interface{}{
			"name":      fmt.Sprintf("Category %d", i+1),
			"image_url": fmt.Sprintf("/uploads/category-%d.png", i+1),
			"position":  i,
			"questions": questions,
		}
	}

	return map[string]interface{}{
		"title":                  title,
		"num_categories":         numCat,
		"questions_per_category": numQ,
		"base_point_value":       baseValue,
		"categories":             categories,
	}
}

// ============================================================================
// TEST SUITE
// ============================================================================

var router *gin.Engine

func TestMain(m *testing.M) {
	router = setupTestRouter()
	cleanDB()
	code := m.Run()
	cleanDB()
	os.Exit(code)
}

// ---------------------------------------------------------------------------
// 1. Game CRUD — Create, List, Get
// ---------------------------------------------------------------------------
func TestCreateGame(t *testing.T) {
	cleanDB()

	game := makeTestGame("Science Trivia", 3, 4, 200)
	w := jsonRequest(router, "POST", "/api/games", game)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var created map[string]interface{}
	parseJSON(w, &created)

	if created["title"] != "Science Trivia" {
		t.Errorf("Expected title 'Science Trivia', got '%v'", created["title"])
	}
	if created["id"] == nil || created["id"].(float64) == 0 {
		t.Error("Expected game to have a non-zero ID")
	}

	t.Logf("✓ Created game with ID %.0f", created["id"].(float64))
}

func TestListGames(t *testing.T) {
	w := jsonRequest(router, "GET", "/api/games", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", w.Code)
	}

	var games []map[string]interface{}
	parseJSON(w, &games)

	if len(games) < 1 {
		t.Fatal("Expected at least 1 game in the list")
	}

	t.Logf("✓ Listed %d game(s)", len(games))
}

func TestGetGame(t *testing.T) {
	// First, list games to get an ID
	listW := jsonRequest(router, "GET", "/api/games", nil)
	var games []map[string]interface{}
	parseJSON(listW, &games)

	if len(games) == 0 {
		t.Fatal("No games to fetch")
	}

	gameID := fmt.Sprintf("%.0f", games[0]["id"].(float64))
	w := jsonRequest(router, "GET", "/api/games/"+gameID, nil)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var game map[string]interface{}
	parseJSON(w, &game)

	// Verify nested categories are preloaded
	cats, ok := game["categories"].([]interface{})
	if !ok || len(cats) == 0 {
		t.Fatal("Expected categories to be preloaded")
	}
	if len(cats) != 3 {
		t.Errorf("Expected 3 categories, got %d", len(cats))
	}

	// Verify nested questions are preloaded
	firstCat := cats[0].(map[string]interface{})
	questions, ok := firstCat["questions"].([]interface{})
	if !ok || len(questions) == 0 {
		t.Fatal("Expected questions to be preloaded in each category")
	}
	if len(questions) != 4 {
		t.Errorf("Expected 4 questions per category, got %d", len(questions))
	}

	// Verify question data
	firstQ := questions[0].(map[string]interface{})
	if firstQ["clue"] == "" {
		t.Error("Expected clue to not be empty")
	}
	if firstQ["answer"] == "" {
		t.Error("Expected answer to not be empty")
	}

	t.Logf("✓ Got game '%s' with %d categories, %d questions each", game["title"], len(cats), len(questions))
}

func TestGetGame_NotFound(t *testing.T) {
	w := jsonRequest(router, "GET", "/api/games/99999", nil)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected 404, got %d", w.Code)
	}

	t.Log("✓ 404 returned for non-existent game")
}

// ---------------------------------------------------------------------------
// 2. Game Update
// ---------------------------------------------------------------------------
func TestUpdateGame(t *testing.T) {
	// Get existing game
	listW := jsonRequest(router, "GET", "/api/games", nil)
	var games []map[string]interface{}
	parseJSON(listW, &games)
	gameID := fmt.Sprintf("%.0f", games[0]["id"].(float64))

	// Update with new data
	updated := makeTestGame("Updated Science Trivia", 3, 4, 300)
	w := jsonRequest(router, "PUT", "/api/games/"+gameID, updated)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	parseJSON(w, &result)

	if result["title"] != "Updated Science Trivia" {
		t.Errorf("Expected updated title, got '%v'", result["title"])
	}

	// Verify point values were updated
	cats := result["categories"].([]interface{})
	firstCat := cats[0].(map[string]interface{})
	questions := firstCat["questions"].([]interface{})
	firstQ := questions[0].(map[string]interface{})

	if int(firstQ["point_value"].(float64)) != 300 {
		t.Errorf("Expected point_value 300, got %.0f", firstQ["point_value"].(float64))
	}

	t.Logf("✓ Game updated successfully to '%s' with base value $300", result["title"])
}

func TestUpdateGame_NotFound(t *testing.T) {
	updated := makeTestGame("Ghost", 1, 1, 100)
	w := jsonRequest(router, "PUT", "/api/games/99999", updated)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected 404, got %d", w.Code)
	}

	t.Log("✓ 404 returned for updating non-existent game")
}

// ---------------------------------------------------------------------------
// 3. Session Lifecycle — Create & Get
// ---------------------------------------------------------------------------
func TestCreateSession(t *testing.T) {
	// Get game ID
	listW := jsonRequest(router, "GET", "/api/games", nil)
	var games []map[string]interface{}
	parseJSON(listW, &games)
	gameID := games[0]["id"].(float64)

	payload := map[string]interface{}{
		"game_id": gameID,
		"contestants": []map[string]interface{}{
			{"name": "Alice", "score": 0},
			{"name": "Bob", "score": 0},
			{"name": "Charlie", "score": 0},
		},
	}

	w := jsonRequest(router, "POST", "/api/sessions", payload)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var session map[string]interface{}
	parseJSON(w, &session)

	// Verify session has ID
	if session["id"] == nil || session["id"].(float64) == 0 {
		t.Error("Expected session to have a non-zero ID")
	}

	// Verify contestants are created
	contestants := session["contestants"].([]interface{})
	if len(contestants) != 3 {
		t.Errorf("Expected 3 contestants, got %d", len(contestants))
	}

	// Verify game data is nested
	game := session["game"].(map[string]interface{})
	if game["title"] == nil {
		t.Error("Expected game to be preloaded in session")
	}

	// Verify game categories/questions are nested in session response
	cats := game["categories"].([]interface{})
	if len(cats) == 0 {
		t.Error("Expected categories preloaded in session game data")
	}

	t.Logf("✓ Created session %.0f with %d contestants for game '%s'", session["id"].(float64), len(contestants), game["title"])
}

func TestGetSession(t *testing.T) {
	// Find session
	var session models.PlaySession
	database.DB.Preload("Contestants").First(&session)

	w := jsonRequest(router, "GET", fmt.Sprintf("/api/sessions/%d", session.ID), nil)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	parseJSON(w, &result)

	// Verify full nested data
	game := result["game"].(map[string]interface{})
	contestants := result["contestants"].([]interface{})
	usedQuestions := result["used_questions"]

	if game["title"] == nil {
		t.Error("Expected game preloaded")
	}
	if len(contestants) != 3 {
		t.Errorf("Expected 3 contestants, got %d", len(contestants))
	}
	if usedQuestions == nil {
		// used_questions can be null/empty initially, that's fine
		t.Log("  (used_questions is empty, as expected for new session)")
	}

	t.Logf("✓ Retrieved session with game '%s' and %d contestants", game["title"], len(contestants))
}

func TestGetSession_NotFound(t *testing.T) {
	w := jsonRequest(router, "GET", "/api/sessions/99999", nil)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected 404, got %d", w.Code)
	}

	t.Log("✓ 404 returned for non-existent session")
}

// ---------------------------------------------------------------------------
// 4. Score Updates
// ---------------------------------------------------------------------------

// findContestantByName finds a contestant by name in a session's contestants list
func findContestantByName(session models.PlaySession, name string) *models.Contestant {
	for i := range session.Contestants {
		if session.Contestants[i].Name == name {
			return &session.Contestants[i]
		}
	}
	return nil
}

func TestUpdateScore_Positive(t *testing.T) {
	var session models.PlaySession
	database.DB.Preload("Contestants").First(&session)
	alice := findContestantByName(session, "Alice")
	if alice == nil {
		t.Fatal("Could not find contestant 'Alice'")
	}

	payload := map[string]interface{}{"score_delta": 500}
	w := jsonRequest(router, "PATCH", fmt.Sprintf("/api/sessions/%d/contestants/%d/score", session.ID, alice.ID), payload)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	parseJSON(w, &result)

	if int(result["score"].(float64)) != 500 {
		t.Errorf("Expected score 500, got %.0f", result["score"].(float64))
	}

	t.Logf("✓ %s score updated to $%.0f", result["name"], result["score"].(float64))
}

func TestUpdateScore_Negative(t *testing.T) {
	// Apply -200 to Alice who currently has 500 from the previous test
	var session models.PlaySession
	database.DB.Preload("Contestants").First(&session)
	alice := findContestantByName(session, "Alice")
	if alice == nil {
		t.Fatal("Could not find contestant 'Alice'")
	}

	payload := map[string]interface{}{"score_delta": -200}
	w := jsonRequest(router, "PATCH", fmt.Sprintf("/api/sessions/%d/contestants/%d/score", session.ID, alice.ID), payload)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	parseJSON(w, &result)

	// Should be 500 - 200 = 300
	if int(result["score"].(float64)) != 300 {
		t.Errorf("Expected score 300 (500 - 200), got %.0f", result["score"].(float64))
	}

	t.Logf("✓ Score correctly updated to $%.0f after -$200 delta", result["score"].(float64))
}

func TestUpdateScore_MultipleContestants(t *testing.T) {
	var session models.PlaySession
	database.DB.Preload("Contestants").First(&session)

	bob := findContestantByName(session, "Bob")
	charlie := findContestantByName(session, "Charlie")
	if bob == nil || charlie == nil {
		t.Fatal("Could not find contestants 'Bob' or 'Charlie'")
	}

	// Update Bob: +800
	payload := map[string]interface{}{"score_delta": 800}
	w := jsonRequest(router, "PATCH", fmt.Sprintf("/api/sessions/%d/contestants/%d/score", session.ID, bob.ID), payload)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", w.Code)
	}

	var bobResult map[string]interface{}
	parseJSON(w, &bobResult)
	if int(bobResult["score"].(float64)) != 800 {
		t.Errorf("Expected Bob's score 800, got %.0f", bobResult["score"].(float64))
	}

	// Update Charlie: -100 (from 0, should go negative)
	payload = map[string]interface{}{"score_delta": -100}
	w = jsonRequest(router, "PATCH", fmt.Sprintf("/api/sessions/%d/contestants/%d/score", session.ID, charlie.ID), payload)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", w.Code)
	}

	var charlieResult map[string]interface{}
	parseJSON(w, &charlieResult)

	if int(charlieResult["score"].(float64)) != -100 {
		t.Errorf("Expected negative score -100, got %.0f", charlieResult["score"].(float64))
	}

	t.Logf("✓ Bob=$%.0f, Charlie=$%.0f — multiple contestants scored independently, negative scores work",
		bobResult["score"].(float64), charlieResult["score"].(float64))
}

func TestUpdateScore_ContestantNotFound(t *testing.T) {
	var session models.PlaySession
	database.DB.First(&session)

	payload := map[string]interface{}{"score_delta": 100}
	w := jsonRequest(router, "PATCH", fmt.Sprintf("/api/sessions/%d/contestants/99999/score", session.ID), payload)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected 404, got %d", w.Code)
	}

	t.Log("✓ 404 returned for non-existent contestant")
}

// ---------------------------------------------------------------------------
// 5. Mark Questions
// ---------------------------------------------------------------------------
func TestMarkQuestion(t *testing.T) {
	var session models.PlaySession
	database.DB.First(&session)

	// Get a question ID from the game
	var question models.Question
	database.DB.First(&question)

	payload := map[string]interface{}{"question_id": question.ID}
	w := jsonRequest(router, "POST", fmt.Sprintf("/api/sessions/%d/mark_question", session.ID), payload)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	parseJSON(w, &result)

	if int(result["question_id"].(float64)) != int(question.ID) {
		t.Errorf("Expected question_id %d, got %.0f", question.ID, result["question_id"].(float64))
	}

	// Verify it appears in session
	sessionW := jsonRequest(router, "GET", fmt.Sprintf("/api/sessions/%d", session.ID), nil)
	var sessionData map[string]interface{}
	parseJSON(sessionW, &sessionData)

	usedQs := sessionData["used_questions"].([]interface{})
	if len(usedQs) < 1 {
		t.Error("Expected at least 1 used question in the session")
	}

	t.Logf("✓ Question %d marked as used, session now has %d used questions", question.ID, len(usedQs))
}

func TestMarkMultipleQuestions(t *testing.T) {
	var session models.PlaySession
	database.DB.First(&session)

	// Get multiple questions
	var questions []models.Question
	database.DB.Limit(3).Find(&questions)

	// Mark remaining questions (first one was already marked)
	for i := 1; i < len(questions); i++ {
		payload := map[string]interface{}{"question_id": questions[i].ID}
		w := jsonRequest(router, "POST", fmt.Sprintf("/api/sessions/%d/mark_question", session.ID), payload)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 for question %d, got %d", questions[i].ID, w.Code)
		}
	}

	// Verify all are in session
	sessionW := jsonRequest(router, "GET", fmt.Sprintf("/api/sessions/%d", session.ID), nil)
	var sessionData map[string]interface{}
	parseJSON(sessionW, &sessionData)

	usedQs := sessionData["used_questions"].([]interface{})
	if len(usedQs) < 3 {
		t.Errorf("Expected at least 3 used questions, got %d", len(usedQs))
	}

	t.Logf("✓ %d questions marked as used in session", len(usedQs))
}

// ---------------------------------------------------------------------------
// 6. File Upload
// ---------------------------------------------------------------------------
func TestUploadMedia(t *testing.T) {
	// Create a test file using multipart form
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	part, err := writer.CreateFormFile("file", "test_image.png")
	if err != nil {
		t.Fatal(err)
	}

	// Write some fake PNG data
	part.Write([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00})
	writer.Close()

	req, _ := http.NewRequest("POST", "/api/upload", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	parseJSON(w, &result)

	url, ok := result["url"].(string)
	if !ok || url == "" {
		t.Fatal("Expected a non-empty URL in response")
	}

	if !strings.HasPrefix(url, "/uploads/") {
		t.Errorf("Expected URL to start with /uploads/, got '%s'", url)
	}

	if !strings.Contains(url, "test_image") {
		t.Errorf("Expected URL to contain original filename 'test_image', got '%s'", url)
	}

	if !strings.HasSuffix(url, ".png") {
		t.Errorf("Expected URL to end with .png, got '%s'", url)
	}

	// Verify the file actually exists on disk
	filepath := "." + url
	if _, err := os.Stat(filepath); os.IsNotExist(err) {
		t.Errorf("Uploaded file does not exist at %s", filepath)
	}

	// Clean up uploaded test file
	os.Remove(filepath)

	t.Logf("✓ File uploaded successfully, URL: %s", url)
}

func TestUploadMedia_NoFile(t *testing.T) {
	req, _ := http.NewRequest("POST", "/api/upload", nil)
	req.Header.Set("Content-Type", "multipart/form-data")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400, got %d", w.Code)
	}

	t.Log("✓ 400 returned when no file is provided")
}

// ---------------------------------------------------------------------------
// 7. Game with Media — Create game with media-typed questions
// ---------------------------------------------------------------------------
func TestCreateGameWithMedia(t *testing.T) {
	game := map[string]interface{}{
		"title":                  "Media Trivia",
		"num_categories":         2,
		"questions_per_category": 2,
		"base_point_value":       100,
		"categories": []map[string]interface{}{
			{
				"name":     "Images",
				"position": 0,
				"questions": []map[string]interface{}{
					{
						"tier":        0,
						"point_value": 100,
						"clue":        "What is this animal?",
						"media_type":  "image",
						"media_url":   "/uploads/test_cat.jpg",
						"options":     `["Cat","Dog","Fish","Bird"]`,
						"answer":      "Cat",
					},
					{
						"tier":        1,
						"point_value": 200,
						"clue":        "Name this landmark",
						"media_type":  "image",
						"media_url":   "/uploads/test_landmark.jpg",
						"options":     "",
						"answer":      "Eiffel Tower",
					},
				},
			},
			{
				"name":     "Audio",
				"position": 1,
				"questions": []map[string]interface{}{
					{
						"tier":        0,
						"point_value": 100,
						"clue":        "Name that tune",
						"media_type":  "audio",
						"media_url":   "/uploads/test_song.mp3",
						"options":     "",
						"answer":      "Beethoven Symphony No. 5",
					},
					{
						"tier":        1,
						"point_value": 200,
						"clue":        "",
						"media_type":  "video",
						"media_url":   "/uploads/test_video.mp4",
						"options":     "",
						"answer":      "The Moon Landing",
					},
				},
			},
		},
	}

	w := jsonRequest(router, "POST", "/api/games", game)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var created map[string]interface{}
	parseJSON(w, &created)

	// Verify media fields are preserved
	gameID := fmt.Sprintf("%.0f", created["id"].(float64))
	getW := jsonRequest(router, "GET", "/api/games/"+gameID, nil)

	var fullGame map[string]interface{}
	parseJSON(getW, &fullGame)

	cats := fullGame["categories"].([]interface{})
	firstCat := cats[0].(map[string]interface{})
	firstQ := firstCat["questions"].([]interface{})[0].(map[string]interface{})

	if firstQ["media_type"] != "image" {
		t.Errorf("Expected media_type 'image', got '%v'", firstQ["media_type"])
	}
	if firstQ["media_url"] != "/uploads/test_cat.jpg" {
		t.Errorf("Expected media_url '/uploads/test_cat.jpg', got '%v'", firstQ["media_url"])
	}
	if firstQ["options"] != `["Cat","Dog","Fish","Bird"]` {
		t.Errorf("Expected options JSON preserved, got '%v'", firstQ["options"])
	}

	t.Logf("✓ Game with media types created and verified (media_type=%s, options=%s)", firstQ["media_type"], firstQ["options"])
}

// ---------------------------------------------------------------------------
// 8. Game Deletion — with cascade cleanup
// ---------------------------------------------------------------------------
func TestDeleteGame(t *testing.T) {
	// Create a fresh game
	game := makeTestGame("To Be Deleted", 2, 2, 100)
	createW := jsonRequest(router, "POST", "/api/games", game)
	var created map[string]interface{}
	parseJSON(createW, &created)
	gameID := fmt.Sprintf("%.0f", created["id"].(float64))

	// Create a session for this game (to test cascade delete of sessions)
	sessionPayload := map[string]interface{}{
		"game_id": created["id"],
		"contestants": []map[string]interface{}{
			{"name": "TestPlayer", "score": 0},
		},
	}
	jsonRequest(router, "POST", "/api/sessions", sessionPayload)

	// Delete the game
	w := jsonRequest(router, "DELETE", "/api/games/"+gameID, nil)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	parseJSON(w, &result)

	if result["status"] != "deleted" {
		t.Errorf("Expected status 'deleted', got '%v'", result["status"])
	}

	// Verify game is gone
	getW := jsonRequest(router, "GET", "/api/games/"+gameID, nil)
	if getW.Code != http.StatusNotFound {
		t.Errorf("Expected 404 after deletion, got %d", getW.Code)
	}

	// Verify associated sessions are also cleaned up
	var sessionCount int64
	database.DB.Model(&models.PlaySession{}).Where("game_id = ?", gameID).Count(&sessionCount)
	if sessionCount != 0 {
		t.Errorf("Expected 0 sessions after game deletion, found %d", sessionCount)
	}

	t.Logf("✓ Game %s deleted with cascading session cleanup", gameID)
}

// ---------------------------------------------------------------------------
// 9. Bad Request Cases
// ---------------------------------------------------------------------------
func TestCreateGame_BadJSON(t *testing.T) {
	req, _ := http.NewRequest("POST", "/api/games", bytes.NewBufferString("not valid json{{{"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400; got %d", w.Code)
	}

	t.Log("✓ 400 returned for invalid JSON on game creation")
}

func TestCreateSession_BadJSON(t *testing.T) {
	req, _ := http.NewRequest("POST", "/api/sessions", bytes.NewBufferString("{bad}"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400, got %d", w.Code)
	}

	t.Log("✓ 400 returned for invalid JSON on session creation")
}

func TestUpdateScore_BadJSON(t *testing.T) {
	var session models.PlaySession
	database.DB.Preload("Contestants").First(&session)

	req, _ := http.NewRequest("PATCH",
		fmt.Sprintf("/api/sessions/%d/contestants/%d/score", session.ID, session.Contestants[0].ID),
		bytes.NewBufferString("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400, got %d", w.Code)
	}

	t.Log("✓ 400 returned for invalid JSON on score update")
}

func TestMarkQuestion_BadJSON(t *testing.T) {
	var session models.PlaySession
	database.DB.First(&session)

	req, _ := http.NewRequest("POST",
		fmt.Sprintf("/api/sessions/%d/mark_question", session.ID),
		bytes.NewBufferString("{bad"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400, got %d", w.Code)
	}

	t.Log("✓ 400 returned for invalid JSON on mark_question")
}

// ---------------------------------------------------------------------------
// 10. Full Workflow — End-to-end API flow
// ---------------------------------------------------------------------------
func TestFullWorkflow(t *testing.T) {
	cleanDB()

	// Step 1: Create a game
	t.Log("Step 1: Creating game...")
	game := makeTestGame("Full Workflow Game", 2, 3, 100)
	createW := jsonRequest(router, "POST", "/api/games", game)
	if createW.Code != http.StatusCreated {
		t.Fatalf("Failed to create game: %s", createW.Body.String())
	}
	var gameData map[string]interface{}
	parseJSON(createW, &gameData)
	gameID := fmt.Sprintf("%.0f", gameData["id"].(float64))
	t.Logf("  → Game created: ID=%s, Title=%s", gameID, gameData["title"])

	// Step 2: Verify game appears in list
	t.Log("Step 2: Verifying game in list...")
	listW := jsonRequest(router, "GET", "/api/games", nil)
	var gamesList []map[string]interface{}
	parseJSON(listW, &gamesList)
	found := false
	for _, g := range gamesList {
		if fmt.Sprintf("%.0f", g["id"].(float64)) == gameID {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("Created game not found in games list")
	}
	t.Log("  → Game found in list ✓")

	// Step 3: Create a session with contestants
	t.Log("Step 3: Creating play session...")
	sessionPayload := map[string]interface{}{
		"game_id": gameData["id"],
		"contestants": []map[string]interface{}{
			{"name": "Team Alpha", "score": 0},
			{"name": "Team Beta", "score": 0},
		},
	}
	sessionW := jsonRequest(router, "POST", "/api/sessions", sessionPayload)
	if sessionW.Code != http.StatusCreated {
		t.Fatalf("Failed to create session: %s", sessionW.Body.String())
	}
	var sessionData map[string]interface{}
	parseJSON(sessionW, &sessionData)
	sessionID := fmt.Sprintf("%.0f", sessionData["id"].(float64))
	contestants := sessionData["contestants"].([]interface{})
	contestant1 := contestants[0].(map[string]interface{})
	contestant2 := contestants[1].(map[string]interface{})
	c1ID := fmt.Sprintf("%.0f", contestant1["id"].(float64))
	c2ID := fmt.Sprintf("%.0f", contestant2["id"].(float64))
	t.Logf("  → Session %s created with contestants: %s (ID=%s), %s (ID=%s)",
		sessionID, contestant1["name"], c1ID, contestant2["name"], c2ID)

	// Step 4: Simulate gameplay — pick questions, adjust scores, mark used
	t.Log("Step 4: Simulating gameplay...")

	// Get questions from the game
	getGameW := jsonRequest(router, "GET", "/api/games/"+gameID, nil)
	var fullGame map[string]interface{}
	parseJSON(getGameW, &fullGame)
	cats := fullGame["categories"].([]interface{})
	firstCat := cats[0].(map[string]interface{})
	questions := firstCat["questions"].([]interface{})

	q1 := questions[0].(map[string]interface{})
	q1ID := fmt.Sprintf("%.0f", q1["id"].(float64))
	pointValue := int(q1["point_value"].(float64))

	// Team Alpha answers correctly — award points
	scoreW := jsonRequest(router, "PATCH",
		fmt.Sprintf("/api/sessions/%s/contestants/%s/score", sessionID, c1ID),
		map[string]interface{}{"score_delta": pointValue})
	if scoreW.Code != http.StatusOK {
		t.Fatalf("Failed to update score: %s", scoreW.Body.String())
	}
	t.Logf("  → Team Alpha: +$%d", pointValue)

	// Mark question as used
	markW := jsonRequest(router, "POST",
		fmt.Sprintf("/api/sessions/%s/mark_question", sessionID),
		map[string]interface{}{"question_id": q1["id"]})
	if markW.Code != http.StatusCreated {
		t.Fatalf("Failed to mark question: %s", markW.Body.String())
	}
	t.Logf("  → Question %s marked as used", q1ID)

	// Second question — Team Beta answers wrong, loses points
	q2 := questions[1].(map[string]interface{})
	pointValue2 := int(q2["point_value"].(float64))

	scoreW2 := jsonRequest(router, "PATCH",
		fmt.Sprintf("/api/sessions/%s/contestants/%s/score", sessionID, c2ID),
		map[string]interface{}{"score_delta": -pointValue2})
	if scoreW2.Code != http.StatusOK {
		t.Fatalf("Failed to update score: %s", scoreW2.Body.String())
	}
	t.Logf("  → Team Beta: -$%d", pointValue2)

	markW2 := jsonRequest(router, "POST",
		fmt.Sprintf("/api/sessions/%s/mark_question", sessionID),
		map[string]interface{}{"question_id": q2["id"]})
	if markW2.Code != http.StatusCreated {
		t.Fatalf("Failed to mark question: %s", markW2.Body.String())
	}

	// Step 5: Verify final session state
	t.Log("Step 5: Verifying final session state...")
	finalW := jsonRequest(router, "GET", "/api/sessions/"+sessionID, nil)
	var finalSession map[string]interface{}
	parseJSON(finalW, &finalSession)

	finalContestants := finalSession["contestants"].([]interface{})
	for _, c := range finalContestants {
		contestant := c.(map[string]interface{})
		t.Logf("  → %s: $%.0f", contestant["name"], contestant["score"].(float64))
	}

	usedQs := finalSession["used_questions"].([]interface{})
	if len(usedQs) != 2 {
		t.Errorf("Expected 2 used questions, got %d", len(usedQs))
	}
	t.Logf("  → %d questions marked as used", len(usedQs))

	// Step 6: Update the game
	t.Log("Step 6: Updating game...")
	updatedGame := makeTestGame("Full Workflow Game - Updated", 2, 3, 200)
	updateW := jsonRequest(router, "PUT", "/api/games/"+gameID, updatedGame)
	if updateW.Code != http.StatusOK {
		t.Fatalf("Failed to update game: %s", updateW.Body.String())
	}
	var updatedResult map[string]interface{}
	parseJSON(updateW, &updatedResult)
	t.Logf("  → Game updated to '%s' with base value $200", updatedResult["title"])

	// Step 7: Delete the game
	t.Log("Step 7: Deleting game...")
	deleteW := jsonRequest(router, "DELETE", "/api/games/"+gameID, nil)
	if deleteW.Code != http.StatusOK {
		t.Fatalf("Failed to delete game: %s", deleteW.Body.String())
	}

	// Verify it's gone
	verifyW := jsonRequest(router, "GET", "/api/games/"+gameID, nil)
	if verifyW.Code != http.StatusNotFound {
		t.Errorf("Expected 404 after deletion, got %d", verifyW.Code)
	}
	t.Log("  → Game deleted and verified gone ✓")

	t.Log("✓ Full workflow completed successfully!")
}
