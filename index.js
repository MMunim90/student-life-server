const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

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
