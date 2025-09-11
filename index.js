const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
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
    // await client.connect();

    //posts api
    const postsCollection = client.db("Brainbox").collection("posts");
    const savedPostsCollection = client.db("Brainbox").collection("savedPosts");
    const scheduleCollection = client.db("Brainbox").collection("schedules");
    const transactionsCollection = client
      .db("Brainbox")
      .collection("transactions");
    const tasksCollection = client.db("Brainbox").collection("tasks");
    const skillsCollection = client.db("Brainbox").collection("skills");
    const examRoutineCollection = client
      .db("Brainbox")
      .collection("examRoutines");

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
          return res.status(403).json({
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
          return res.status(403).json({
            message: "You are not authorized to delete this schedule",
          });
        }

        res.send(result);
      } catch (error) {
        console.error("Error deleting schedule:", error);
        res.status(500).send({ message: "Failed to delete schedule" });
      }
    });

    // Get last 5 transactions for a user
    app.get("/transactions/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const transactions = await transactionsCollection
          .find({ email })
          .sort({ date: -1 })
          .toArray();
        res.send(transactions);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch transactions" });
      }
    });

    // Add new transaction
    app.post("/transactions", async (req, res) => {
      try {
        const transaction = req.body;

        // insertOne returns { acknowledged, insertedId }
        const result = await transactionsCollection.insertOne(transaction);

        // fetch the inserted doc to return it
        const insertedDoc = await transactionsCollection.findOne({
          _id: result.insertedId,
        });

        res.send(insertedDoc);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to add transaction" });
      }
    });

    // DELETE a transaction by id
    app.delete("/transactions/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await transactionsCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res
            .status(200)
            .send({ success: true, message: "Transaction deleted" });
        } else {
          res
            .status(404)
            .send({ success: false, message: "Transaction not found" });
        }
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    //  Get tasks by email
    app.get("/tasks", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }

        const tasks = await tasksCollection.find({ email }).toArray();
        res.json(tasks);
      } catch (err) {
        console.error("Error fetching tasks:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    //  Add a new task
    app.post("/tasks", async (req, res) => {
      try {
        const task = req.body;
        if (!task.subject || !task.deadline || !task.email) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const result = await tasksCollection.insertOne(task);
        res.json({ insertedId: result.insertedId });
      } catch (err) {
        console.error("Error adding task:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Update task (edit details or toggle complete)
    app.patch("/tasks/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { subject, priority, deadline, hour, isCompleted } = req.body;

        // Validate ID
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid task ID" });
        }

        // Only update provided fields
        const updatedFields = {};
        if (subject !== undefined) updatedFields.subject = subject;
        if (priority !== undefined) updatedFields.priority = priority;
        if (deadline !== undefined) updatedFields.deadline = deadline;
        if (hour !== undefined) updatedFields.hour = hour;
        if (isCompleted !== undefined) updatedFields.isCompleted = isCompleted;

        const result = await tasksCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedFields }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Task not found" });
        }

        res.json({
          modifiedCount: result.modifiedCount,
          message: "Task updated successfully",
        });
      } catch (err) {
        console.error("Error updating task:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    //  Delete a task
    app.delete("/tasks/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await tasksCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.json({ deletedCount: result.deletedCount });
      } catch (err) {
        console.error("Error deleting task:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // GET all skills for a user
    app.get("/skills", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email)
          return res.status(400).json({ message: "Email is required" });

        const skills = await skillsCollection
          .find({ email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(skills);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // POST route
    app.post("/skills", async (req, res) => {
      try {
        const { email, skill, goal, milestone, progress, startDate, endDate } =
          req.body;
        if (!email || !skill || !goal) {
          return res
            .status(400)
            .json({ message: "Email, skill, and goal are required" });
        }

        const doc = {
          email,
          skill,
          goal,
          milestone: milestone || "",
          progress: Number(progress) || 0,
          startDate: startDate || null,
          endDate: endDate || null,
          status: "in-progress",
          createdAt: new Date(),
        };

        const result = await skillsCollection.insertOne(doc);
        res.send(result);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // DELETE a skill
    app.delete("/skills/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await skillsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // PATCH route
    app.patch("/skills/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { status, milestone, goal, progress, startDate, endDate } =
          req.body;

        const updateDoc = { $set: {} };
        if (status) updateDoc.$set.status = status;
        if (milestone) updateDoc.$set.milestone = milestone;
        if (goal) updateDoc.$set.goal = goal;
        if (progress !== undefined) updateDoc.$set.progress = Number(progress);
        if (startDate) updateDoc.$set.startDate = startDate;
        if (endDate) updateDoc.$set.endDate = endDate;

        const result = await skillsCollection.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );
        res.send(result);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // CREATE (Add new exam routine)
    app.post("/exam-routines", async (req, res) => {
      try {
        const routine = req.body;
        if (!routine.email) {
          return res.status(400).send({ error: "User email is required" });
        }
        const result = await examRoutineCollection.insertOne(routine);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to add routine" });
      }
    });

    // READ (Get all exam routines for a specific user)
    app.get("/exam-routines", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).send({ error: "User email is required" });
        }
        const routines = await examRoutineCollection.find({ email }).toArray();
        res.send(routines);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to fetch routines" });
      }
    });

    // UPDATE (Edit exam routine or mark as done)
    app.patch("/exam-routines/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedRoutine = req.body;

        if (!updatedRoutine.email) {
          return res.status(400).send({ error: "User email is required" });
        }

        const filter = { _id: new ObjectId(id), email: updatedRoutine.email };
        const updateDoc = {
          $set: {
            courseName: updatedRoutine.courseName,
            courseCode: updatedRoutine.courseCode,
            examDate: updatedRoutine.examDate,
            examTime: updatedRoutine.examTime,
            building: updatedRoutine.building,
            roomNumber: updatedRoutine.roomNumber,
            status: updatedRoutine.status || "pending", // add this
          },
        };

        const result = await examRoutineCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .send({ error: "Routine not found or not authorized" });
        }

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to update routine" });
      }
    });

    // DELETE (Remove exam routine - only if it belongs to the user)
    app.delete("/exam-routines/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const email = req.query.email; // User email must be sent as query param
        if (!email) {
          return res.status(400).send({ error: "User email is required" });
        }

        const query = { _id: new ObjectId(id), email };
        const result = await examRoutineCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ error: "Routine not found or not authorized" });
        }

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to delete routine" });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
