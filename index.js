const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const { ObjectId } = require("mongodb");

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5tlsytf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //posts api
    const postsCollection = client.db("Brainbox").collection("posts");
    const savedPostsCollection = client.db("Brainbox").collection("savedPosts");
    const scheduleCollection = client.db("Brainbox").collection("schedules");

    // posts.routes.js

    // Add new post
    app.post("/addPosts", async (req, res) => {
      try {
        const post = req.body;
        post.createdAt = new Date();

        const result = await postsCollection.insertOne(post);

        res.status(201).send({
          success: true,
          message: "Post added successfully",
          data: result,
        });
      } catch (error) {
        console.error("Error adding post:", error);
        res.status(500).send({
          success: false,
          message: "Failed to add post",
        });
      }
    });

    // Get all posts
    app.get("/getAllPosts", async (req, res) => {
      try {
        const posts = await postsCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.send(posts);
      } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch posts",
        });
      }
    });

    // Get posts by user email
    app.get("/getUserPosts/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const posts = await postsCollection
          .find({ userEmail: email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(posts);
      } catch (error) {
        console.error("Error fetching user posts:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch user posts",
        });
      }
    });

    // DELETE a post by ID
    app.delete("/posts/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid post ID" });
        }

        // 1. Delete from posts collection
        const result = await postsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Post not found" });
        }

        // 2. Delete related saved posts
        const savedResult = await savedPostsCollection.deleteMany({
          postId: id,
        });

        res.status(200).json({
          message: "Post deleted successfully",
          deletedFromPosts: result.deletedCount,
          deletedFromSavedPosts: savedResult.deletedCount,
        });
      } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Save a post
    app.post("/savedPosts", async (req, res) => {
      try {
        const savedPost = req.body;

        const existing = await savedPostsCollection.findOne({
          postId: savedPost.postId,
          posterEmail: savedPost.userEmail,
        });

        if (existing) {
          return res
            .status(400)
            .send({ message: "You already saved this post" });
        }

        const result = await savedPostsCollection.insertOne(savedPost);
        res.send(result);
      } catch (error) {
        console.error("Error saving post:", error);
        res.status(500).send({ message: "Failed to save post" });
      }
    });

    // Get all saved posts for a user
    app.get("/savedPosts/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { userEmail: email };
        const result = await savedPostsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching saved posts:", error);
        res.status(500).send({ message: "Failed to fetch saved posts" });
      }
    });

    // Delete a saved post
    app.delete("/savedPosts/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await savedPostsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error deleting saved post:", error);
        res.status(500).send({ message: "Failed to delete saved post" });
      }
    });

    // Like a post
    app.post("/posts/:id/like", async (req, res) => {
      try {
        const { id } = req.params;
        const { userEmail } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid post ID" });
        }

        const post = await postsCollection.findOne({ _id: new ObjectId(id) });
        if (!post) return res.status(404).json({ message: "Post not found" });

        if (post.likes?.includes(userEmail)) {
          return res
            .status(400)
            .json({ message: "You already liked this post" });
        }

        await postsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $push: { likes: userEmail } }
        );

        // Return the updated post
        const updatedPost = await postsCollection.findOne({
          _id: new ObjectId(id),
        });
        res.status(200).json(updatedPost);
      } catch (error) {
        console.error("Error liking post:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Unlike a post
    app.post("/posts/:id/unlike", async (req, res) => {
      try {
        const { id } = req.params;
        const { userEmail } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid post ID" });
        }

        await postsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $pull: { likes: userEmail } }
        );

        // Return the updated post
        const updatedPost = await postsCollection.findOne({
          _id: new ObjectId(id),
        });
        res.status(200).json(updatedPost);
      } catch (error) {
        console.error("Error unliking post:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // GET all schedules for a specific user
    app.get("/schedules", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email)
          return res.status(400).json({ message: "Email is required" });

        const schedules = await scheduleCollection.find({ email }).toArray();
        res.send(schedules);
      } catch (error) {
        console.error("Error fetching schedules:", error);
        res.status(500).send({ message: "Failed to fetch schedules" });
      }
    });

    // CREATE new schedule
    app.post("/schedules", async (req, res) => {
      try {
        const schedule = req.body;
        if (!schedule.email)
          return res.status(400).json({ message: "Email is required" });

        const result = await scheduleCollection.insertOne(schedule);
        res.status(201).send(result);
      } catch (error) {
        console.error("Error creating schedule:", error);
        res.status(500).send({ message: "Failed to create schedule" });
      }
    });

    // UPDATE schedule (only if email matches)
    app.patch("/schedules/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updated = req.body;

        if (!ObjectId.isValid(id))
          return res.status(400).json({ message: "Invalid schedule ID" });
        if (!updated.email)
          return res.status(400).json({ message: "Email is required" });

        // Update only if the schedule belongs to this user
        const result = await scheduleCollection.updateOne(
          { _id: new ObjectId(id), email: updated.email },
          { $set: updated }
        );

        if (result.matchedCount === 0) {
          return res
            .status(403)
            .json({
              message: "You are not authorized to update this schedule",
            });
        }

        res.send(result);
      } catch (error) {
        console.error("Error updating schedule:", error);
        res.status(500).send({ message: "Failed to update schedule" });
      }
    });

    // DELETE schedule (only if email matches)
    app.delete("/schedules/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { email } = req.query;

        if (!ObjectId.isValid(id))
          return res.status(400).json({ message: "Invalid schedule ID" });
        if (!email)
          return res.status(400).json({ message: "Email is required" });

        const result = await scheduleCollection.deleteOne({
          _id: new ObjectId(id),
          email,
        });

        if (result.deletedCount === 0) {
          return res
            .status(403)
            .json({
              message: "You are not authorized to delete this schedule",
            });
        }

        res.send(result);
      } catch (error) {
        console.error("Error deleting schedule:", error);
        res.status(500).send({ message: "Failed to delete schedule" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Brainbox server is running");
});

app.listen(port, () => {
  console.log(`Brainbox server is running on port ${port}`);
});
