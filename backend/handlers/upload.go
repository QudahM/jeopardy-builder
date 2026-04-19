package handlers

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
)

// UploadMedia handles file uploads for media content
func UploadMedia(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file is received"})
		return
	}

	// Create uploads directory if it does not exist
	uploadsDir := "./uploads"
	if _, err := os.Stat(uploadsDir); os.IsNotExist(err) {
		if mkdirErr := os.Mkdir(uploadsDir, os.ModePerm); mkdirErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create uploads directory"})
			return
		}
	}

	// Generate a unique file name
	ext := filepath.Ext(file.Filename)
	timestamp := time.Now().UnixNano()
	filename := fmt.Sprintf("%d%s", timestamp, ext)
	dst := filepath.Join(uploadsDir, filename)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Transcode unsupported video formats to mp4
	if ext == ".mov" || ext == ".mkv" || ext == ".avi" {
		newFilename := fmt.Sprintf("%d.mp4", timestamp)
		newDst := filepath.Join(uploadsDir, newFilename)

		cmd := exec.Command("ffmpeg", "-y", "-i", dst, "-c:v", "libx264", "-c:a", "aac", newDst)
		if err := cmd.Run(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to transcode video"})
			return
		}

		// Delete the original file
		os.Remove(dst)
		filename = newFilename
	}

	url := fmt.Sprintf("/uploads/%s", filename)
	c.JSON(http.StatusOK, gin.H{
		"url": url,
	})
}
