package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jeopardy-game/backend/database"
	"github.com/jeopardy-game/backend/handlers"
)

func main() {
	database.ConnectDB()

	r := gin.Default()

	// CORS Setup
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	r.Use(cors.New(config))

	api := r.Group("/api")
	{
		// Games
		api.GET("/games", handlers.GetGames)
		api.POST("/games", handlers.CreateGame)
		api.GET("/games/:id", handlers.GetGame)
		api.DELETE("/games/:id", handlers.DeleteGame)
		api.PUT("/games/:id", handlers.UpdateGame)

		// Sessions
		api.POST("/sessions", handlers.CreateSession)
		api.GET("/sessions/:id", handlers.GetSession)
		api.PATCH("/sessions/:id/contestants/:cid/score", handlers.UpdateScore)
		api.POST("/sessions/:id/mark_question", handlers.MarkQuestion)

		// Uploads
		api.POST("/upload", handlers.UploadMedia)
	}

	// Serve static files from the uploads directory
	r.Static("/uploads", "./uploads")

	log.Println("Backend server is running on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
