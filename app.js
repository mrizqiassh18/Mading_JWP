const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const app = express();
const multer = require('multer');
const path = require('path');

app.use(express.static('public'));
app.use(express.urlencoded({ extended: false}));

app.use(
    session({
      secret: 'secret_key',
      resave: false,
      saveUninitialized: false,
    })
  );

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'mading_jewepe'
});

//Pengaturan Multer untuk mengelola file upload

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public/uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.use((req, res, next) => {
    if ( req.session.userId === undefined) {
        res.locals.isLoggedIn = false;
    } else {
        res.locals.isLoggedIn = true;
    }
    next();
})

app.get('/', (req, res) => {
    connection.query(
        `SELECT * FROM mading`,
        (error, results) => {
            res.render('landing-page.ejs', {mading: results});
        }
    );
    
});

app.get('/login', (req, res) => {
    res.render('login.ejs');
});

app.post('/login', (req, res) => {
    const email = req.body.email;
    connection.query(
        `SELECT * FROM user WHERE email = ?`,
        [email],
        (error, results) => {
            if (results.length > 0){
                if (req.body.password === results[0].password) {
                    req.session.userId = results[0].id;
                    res.redirect('/dashboard');
                } else {
                    res.redirect('/login');
                }
            } else {
                res.redirect('/login');
            }
            if (error) {
                console.log(error);
            } 
        }
    );
});

app.get('/details/:id', (req, res) => {
    const id = req.params.id;
    connection.query(
        `SELECT * FROM mading WHERE id = ?`,
        [id],
        (error, madingResults) => {
            if (error){
                console.log(error.message);
            } else{
                connection.query(
                    `SELECT * FROM komentar WHERE mading_id = ?`,[id],
                    (error, komentarResults) => {
                        res.render('details.ejs', {item: madingResults[0], komentar: komentarResults});
                    });
            }
            
        });
});

app.post('/komentar', (req, res) => {
    const madingId = req.body.madingId;
    const nama = req.body.nama_pengguna;
    const komentar = req.body.komentar;
    const email = req.body.email;

    connection.query(
            `INSERT INTO komentar (mading_id, nama, komentar, email) VALUES (?,?,?,?)`,
            [madingId, nama, komentar, email],
            (error, results) => {
                if (error) {
                   console.log(error);
                } else {
                    res.redirect('/details/' + madingId);
                }
            });
});

app.get('/dashboard', (req, res) => {
    if (res.locals.isLoggedIn) {
        connection.query(`SELECT COUNT(*) as "totalMading" FROM mading`, (error, results1) => {
            if (error) {
                console.log(error);
            } else {
                connection.query(`SELECT COUNT(*) as "totalKomentar" FROM komentar`, (error, results2) => {
                    if (error) {
                        console.log(error);
                    } else{
                        const totalMading = results1[0].totalMading;
                        const totalKomentar = results2[0].totalKomentar;
                        res.render('dashboard.ejs', { totalMading, totalKomentar });
                    }
                });
            }
        });
    } else {
        res.redirect('/login');
    }
});

app.get('/input', (req, res) => {
    if (res.locals.isLoggedIn) {
        res.render('input.ejs');
    }else {
        res.redirect('/login');
    }
});

app.post('/input', upload.single('image'), (req, res) => {
    const judul = req.body.judulName;
    const caption = req.body.caption;
    const image = req.file.filename;
    
    connection.query(
            `INSERT INTO mading (judul, caption, img) VALUES (?,?,?)`,
            [judul, caption, image],
            (error, results) => {
                if (error) {
                    console.log(error);
                } else {
                    res.redirect('/input')
                }
    });
});

app.get('/list-mading-admin', (req, res) => {
    if (res.locals.isLoggedIn) {
        connection.query(`SELECT * FROM mading`, (error, results) => {
            if (error) {
                console.log(error);
            } else {
                res.render('list-mading-admin.ejs', {mading: results});
            }
        });    
    }else {
        res.redirect('/login');
    }
});

app.get('/details-admin/:id', (req, res) => {
    if (res.locals.isLoggedIn) {
        const id = req.params.id;
        connection.query(
        `SELECT * FROM mading WHERE id = ?`,
        [id],
        (error, madingResults) => {
            if (error){
                console.log(error.message);
            } else{
                connection.query(
                    `SELECT * FROM komentar WHERE mading_id = ?`,[id],
                    (error, komentarResults) => {
                        res.render('details-admin.ejs', {item: madingResults[0], komentar: komentarResults});
            });
            }
        });
    } else {
        res.redirect('/login');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((error) => {
        res.redirect('/');
    });
});

app.post('/delete-mading/:id', (req, res) => {
    const madingId = req.params.id;
    connection.query(
        `DELETE FROM komentar WHERE mading_id = ?`,
        [madingId],
        (error, results) => {
            if (error) {
                console.log(error);
        } else {
            connection.query(
                `DELETE FROM mading WHERE id =?`,
                [madingId],
                (error, results) => {
                    if (error) {
                        console.log(error);
                    } else {
                        res.redirect('/list-mading-admin');
                    }
                });
        }
    });
});

app.post('/hapus-komentar/:id', (req, res) => {
    const komentarId = req.params.id;
    connection.query(
        `SELECT mading_id FROM komentar WHERE id = ?`,
        [komentarId],
        (error, madingIdResult) => {
            if (error) {
                console.log(error);
                return res.status(500).send('Internal Server Error');
            }

            const madingId = madingIdResult[0].mading_id;

            connection.query(
                `DELETE FROM komentar WHERE id = ?`,
                [komentarId],
                (error, results) => {
                    if (error) {
                        console.log(error);
                        return res.status(500).send('Internal Server Error');
                    }

                    // Redirect kembali ke halaman details-admin berdasarkan ID mading
                    res.redirect('/details-admin/' + madingId);
                }
            );
        }
    );
});

app.listen(3001);