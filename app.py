from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/c_major_scale')
def c_major_scale():
    return render_template('c_major_scale.html')

@app.route('/natural_scale_training')
def natural_scale_training():
    return render_template('natural_scale_training.html')

@app.route('/free_training')
def free_training():
    return render_template('free_training.html')

@app.route('/piano_test')
def piano_test():
    return render_template('piano_test.html')

@app.route('/pitch_training')
def pitch_training():
    return render_template('pitch_training.html')

if __name__ == '__main__':
    app.run(debug=True)